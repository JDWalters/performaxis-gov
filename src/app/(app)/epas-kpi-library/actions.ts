"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppraisalCycleId } from "@/lib/data/appraisal-kpi-library";
import { balanceWeights, type WeightKpi } from "@/lib/data/appraisal-scoring";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Creates or updates one EPAS KPI library entry. RLS (epaslib_insert/update,
 * via has_org_access "manage_org_setup") is the real gatekeeper - the same
 * permission that gates EPAS Setup and the competency framework, since the
 * library is part of that same municipality-level EPAS configuration.
 */
export async function saveAppraisalKpiLibraryEntry(formData: FormData) {
  const id = str(formData, "id");
  const orgId = str(formData, "orgId");
  const refCode = str(formData, "refCode");
  const kpa = str(formData, "kpa");
  const name = str(formData, "name");
  const unitOfMeasure = str(formData, "unitOfMeasure");
  const idpRef = str(formData, "idpRef");
  const baseline = str(formData, "baseline");
  const annualTarget = str(formData, "annualTarget");
  const poe = str(formData, "poe");
  const c88Code = str(formData, "c88Code");
  const allocatedEmployeeId = str(formData, "allocatedEmployeeId");

  if (!orgId || !kpa || !name) {
    throw new Error("Municipality, KPA and indicator description are required.");
  }

  const supabase = await createClient();
  const row = {
    org_id: orgId,
    ref_code: refCode || null,
    kpa: kpa || null,
    name,
    unit_of_measure: unitOfMeasure || null,
    idp_ref: idpRef || null,
    baseline: baseline || null,
    annual_target: annualTarget || null,
    poe: poe || null,
    c88_code: c88Code || null,
    allocated_employee_id: allocatedEmployeeId || null,
  };

  // Cast: same pragmatic workaround used throughout this codebase for
  // supabase-js's generic insert()/update() overload resolution.
  const table = supabase.from("appraisal_kpi_library") as unknown as {
    update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };

  if (id) {
    const { error } = await table.update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await table.insert([row]);
    if (error) throw error;
  }

  revalidatePath("/epas-kpi-library");
  redirect(`/epas-kpi-library?org=${orgId}`);
}

/**
 * Removes one indicator from the library - plans that already used it keep
 * their copy untouched (kpi_library_id set null on delete). Called directly
 * from a client onClick (not a plain <form action>), so this revalidates
 * and returns rather than redirecting - matching deleteAnnexureKpi's
 * convention elsewhere in the EPAS module.
 */
export async function deleteAppraisalKpiLibraryEntry(formData: FormData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Missing indicator.");

  const supabase = await createClient();
  const { error } = await supabase.from("appraisal_kpi_library").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/epas-kpi-library");
}

/** Bulk-removes several indicators at once - the reference's "Delete selected". */
export async function bulkDeleteAppraisalKpiLibraryEntries(formData: FormData) {
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);
  if (!ids.length) return;

  const supabase = await createClient();
  const { error } = await supabase.from("appraisal_kpi_library").delete().in("id", ids);
  if (error) throw error;

  revalidatePath("/epas-kpi-library");
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

async function persistWeights(cycleId: string, balanced: Map<string, number>) {
  const supabase = await createClient();
  const current = await fetchWeightRows(cycleId);
  const table = supabase.from("appraisal_kpis") as unknown as {
    update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
  for (const k of current) {
    const nextWeight = balanced.get(k.id);
    if (nextWeight === undefined) continue;
    const { error } = await table.update({ weight: nextWeight }).eq("id", k.id);
    if (error) throw error;
  }
}

/**
 * Adds one or more library indicators to an employee's Annexure A plan for a
 * financial year - mirrors the reference's lib-add/lib-bulkadd. Every
 * indicator added joins the automatic weight split (unlocked, weight 0), and
 * anything already in the plan (matched by name, case-insensitive) is
 * silently skipped rather than duplicated. Requires the employee to already
 * have an appraisal_cycle for that year - this app never creates cycles on
 * the fly, so a missing one surfaces as a thrown error the caller can show.
 */
export async function addLibraryEntriesToPlan(formData: FormData): Promise<{ added: number; skipped: number; employeeName?: string }> {
  const employeeId = str(formData, "employeeId");
  const financialYearId = str(formData, "financialYearId");
  const ids = formData.getAll("ids").map((v) => String(v)).filter(Boolean);

  if (!employeeId || !financialYearId) throw new Error("Select an employee first - the indicator is added to that employee's performance plan.");
  if (!ids.length) return { added: 0, skipped: 0 };

  const cycleId = await getAppraisalCycleId(employeeId, financialYearId);
  if (!cycleId) {
    throw new Error("This employee has no performance plan for the selected financial year yet - nothing to add to.");
  }

  const supabase = await createClient();
  const { data: libRows, error: libErr } = await supabase
    .from("appraisal_kpi_library")
    .select("id, kpa, name, unit_of_measure, baseline, annual_target, poe")
    .in("id", ids);
  if (libErr) throw libErr;
  type LibPick = { id: string; kpa: string | null; name: string; unit_of_measure: string | null; baseline: string | null; annual_target: string | null; poe: string | null };
  const picks = (libRows ?? []) as unknown as LibPick[];
  if (!picks.length) return { added: 0, skipped: 0 };

  const { data: existingRows, error: existingErr } = await supabase
    .from("appraisal_kpis")
    .select("name")
    .eq("appraisal_cycle_id", cycleId);
  if (existingErr) throw existingErr;
  const have = new Set(((existingRows ?? []) as unknown as { name: string }[]).map((r) => r.name.trim().toLowerCase()));

  const toInsert = picks
    .filter((p) => !have.has(p.name.trim().toLowerCase()))
    .map((p) => ({
      appraisal_cycle_id: cycleId,
      kpi_library_id: p.id,
      kpa: p.kpa,
      name: p.name,
      unit_of_measure: p.unit_of_measure,
      baseline: p.baseline,
      annual_target: p.annual_target,
      poe: p.poe,
      weight: 0,
      weight_locked: false,
    }));

  if (toInsert.length) {
    const table = supabase.from("appraisal_kpis") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await table.insert(toInsert);
    if (error) throw error;

    const rows = await fetchWeightRows(cycleId);
    await persistWeights(cycleId, balanceWeights(rows));
  }

  revalidatePath(`/appraisals/${cycleId}`);
  revalidatePath("/epas-kpi-library");
  return { added: toInsert.length, skipped: picks.length - toInsert.length };
}
