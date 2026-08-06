"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { balanceWeights, scaleWeightsTo100, evenSplitWeights, type WeightKpi } from "@/lib/data/appraisal-scoring";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function fetchWeightRows(cycleId: string): Promise<WeightKpi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_kpis")
    .select("id, weight, weight_locked")
    .eq("appraisal_cycle_id", cycleId)
    .order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: string; weight: number; weight_locked: boolean }[];
  return rows.map((r) => ({ id: r.id, weight: r.weight, weightLocked: r.weight_locked }));
}

/** Writes a balanced-weights result back to the DB, one row per KPI whose weight actually changed. */
async function persistWeights(cycleId: string, balanced: Map<string, number>, lockOverride?: boolean) {
  const supabase = await createClient();
  const current = await fetchWeightRows(cycleId);
  const table = supabase.from("appraisal_kpis") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  for (const k of current) {
    const nextWeight = balanced.get(k.id);
    if (nextWeight === undefined) continue;
    const values: Record<string, unknown> = { weight: nextWeight };
    if (lockOverride !== undefined) values.weight_locked = lockOverride;
    const { error } = await table.update(values).eq("id", k.id);
    if (error) throw error;
  }
}

/** Adds a blank KPI to the plan, unlocked so it joins the automatic weight split - mirrors the reference's "+ Add performance indicator". */
export async function addAnnexureKpi(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  if (!cycleId) throw new Error("Missing cycle.");

  const supabase = await createClient();
  const table = supabase.from("appraisal_kpis") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await table.insert([
    {
      appraisal_cycle_id: cycleId,
      name: "New performance indicator",
      weight: 0,
      weight_locked: false,
    },
  ]);
  if (error) throw error;

  const rows = await fetchWeightRows(cycleId);
  await persistWeights(cycleId, balanceWeights(rows));
  revalidatePath(`/appraisals/${cycleId}`);
}

/** Updates one text field on a KPI (kpa/name/unit/baseline/annual/poe) - never touches weight. */
export async function updateAnnexureKpiField(formData: FormData) {
  const id = str(formData, "id");
  const cycleId = str(formData, "cycleId");
  const field = str(formData, "field");
  const value = str(formData, "value");
  const allowed = new Set(["kpa", "name", "unit_of_measure", "baseline", "annual_target", "poe"]);
  if (!id || !allowed.has(field)) throw new Error("Invalid field.");

  const supabase = await createClient();
  const table = supabase.from("appraisal_kpis") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await table.update({ [field]: value || null }).eq("id", id);
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/**
 * Sets one quarter's target for a KPI. Upserts against the existing
 * appraisal_ratings row for that (kpi, quarter) if one already exists -
 * critical, because that same row may already hold real captured
 * actual/self/mgr/panel data from a prior quarter's capture, and this must
 * only ever touch target_value, never wipe what's already been captured.
 */
export async function updateAnnexureKpiTarget(formData: FormData) {
  const kpiId = str(formData, "kpiId");
  const cycleId = str(formData, "cycleId");
  const quarter = Number(str(formData, "quarter"));
  const value = str(formData, "value");
  if (!kpiId || !quarter) throw new Error("Missing KPI or quarter.");

  const supabase = await createClient();
  const { data: existingData, error: findErr } = await supabase
    .from("appraisal_ratings")
    .select("id")
    .eq("appraisal_kpi_id", kpiId)
    .eq("quarter", quarter)
    .maybeSingle();
  if (findErr) throw findErr;
  // Cast: same pragmatic workaround used throughout this codebase - a
  // partial select sometimes collapses supabase-js's inferred row type to
  // `never`.
  const existing = existingData as unknown as { id: string } | null;

  if (existing) {
    const table = supabase.from("appraisal_ratings") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await table.update({ target_value: value || null }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const table = supabase.from("appraisal_ratings") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await table.insert([{ appraisal_kpi_id: kpiId, quarter, target_value: value || null }]);
    if (error) throw error;
  }

  revalidatePath(`/appraisals/${cycleId}`);
}

/**
 * Sets one KPI's weight. A blank value un-pins it (rejoins the automatic
 * split); any other value pins it exactly as typed, and every other
 * unlocked KPI in the plan re-shares whatever's left over.
 */
export async function updateAnnexureKpiWeight(formData: FormData) {
  const kpiId = str(formData, "kpiId");
  const cycleId = str(formData, "cycleId");
  const raw = str(formData, "weight");
  if (!kpiId || !cycleId) throw new Error("Missing KPI or cycle.");

  const current = await fetchWeightRows(cycleId);
  const isUnlocking = raw === "";
  const updated = current.map((k) =>
    k.id === kpiId ? { ...k, weight: isUnlocking ? k.weight : Number(raw) || 0, weightLocked: !isUnlocking } : k
  );

  await persistWeights(cycleId, balanceWeights(updated));
  // persistWeights above balances weights but doesn't touch weight_locked for
  // untouched rows - explicitly set this one KPI's lock state since it's the
  // only one whose lock actually changed.
  const supabase = await createClient();
  const table = supabase.from("appraisal_kpis") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await table.update({ weight_locked: !isUnlocking }).eq("id", kpiId);
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Deletes a KPI (cascades its ratings/history for this cycle) and rebalances what's left. */
export async function deleteAnnexureKpi(formData: FormData) {
  const kpiId = str(formData, "kpiId");
  const cycleId = str(formData, "cycleId");
  if (!kpiId || !cycleId) throw new Error("Missing KPI or cycle.");

  const supabase = await createClient();
  const { error } = await supabase.from("appraisal_kpis").delete().eq("id", kpiId);
  if (error) throw error;

  const rows = await fetchWeightRows(cycleId);
  await persistWeights(cycleId, balanceWeights(rows));
  revalidatePath(`/appraisals/${cycleId}`);
}

/** Unlocks and equally weights every KPI - the reference's "Even split" button. */
export async function evenSplitAnnexureWeights(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  if (!cycleId) throw new Error("Missing cycle.");

  const rows = await fetchWeightRows(cycleId);
  await persistWeights(cycleId, evenSplitWeights(rows), false);
  revalidatePath(`/appraisals/${cycleId}`);
}

/** Proportionally scales every (pinned) weight so the column totals 100% - the reference's "Scale to 100%" button. */
export async function scaleAnnexureWeightsTo100(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  if (!cycleId) throw new Error("Missing cycle.");

  const rows = await fetchWeightRows(cycleId);
  await persistWeights(cycleId, scaleWeightsTo100(rows), true);
  revalidatePath(`/appraisals/${cycleId}`);
}

const AGREEMENT_FIELDS: Record<string, string> = {
  employeeSignatory: "employee_signatory",
  employerSignatory: "employer_signatory",
  signPlace: "sign_place",
  signDate: "sign_date",
};

/**
 * Updates one field of the performance agreement's signature block - upserts
 * against the (appraisal_cycle_id) unique key, touching only the named
 * field. RLS (agreements_insert/update, via has_employee_access(...,
 * 'sign_agreements')) is the real gatekeeper; canSignAsEmployer/
 * canSignAsEmployee in annexure.ts only decide which field the UI exposes.
 */
export async function saveAgreementField(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const field = str(formData, "field");
  const value = str(formData, "value");
  const column = AGREEMENT_FIELDS[field];
  if (!cycleId || !column) throw new Error("Invalid field.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("agreements") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_cycle_id: cycleId, [column]: value || null }], { onConflict: "appraisal_cycle_id" });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Toggles the agreement's signed/draft status - a manual finalisation step, gated (via RLS) the same way as every other field on this record. */
export async function setAgreementStatus(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const status = str(formData, "status");
  if (!cycleId || (status !== "draft" && status !== "signed")) throw new Error("Invalid status.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("agreements") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_cycle_id: cycleId, status }], { onConflict: "appraisal_cycle_id" });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}
