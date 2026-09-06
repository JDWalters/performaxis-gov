"use server";

/**
 * Bulk KPI operations for a scorecard: adding KPIs copied from the
 * department's kpi_library, and deleting KPIs that no longer belong. This is
 * the first code in the app that ever writes to scorecard_kpis - previously
 * every row came from a one-off data migration. RLS (sckpi_insert/delete,
 * gated on manage_scorecard_setup) is the real gatekeeper, same as
 * kpi_library's own insert/update policies - this just adds the
 * defense-in-depth checks (org match) a careless client payload shouldn't be
 * able to bypass.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestNextRefCodes } from "@/lib/data/scorecards-shared";

/**
 * Copies one or more kpi_library rows onto a scorecard as new scorecard_kpis
 * rows. kpi_library is only ever a *starting template*: its calc_config
 * (answer type + accumulation + lower-is-better) and its 6 scorecard-setup
 * narrative fields (method, kpi_type, wards, baseline, annual_target, poe)
 * are copied into the new scorecard_kpis row's own columns, then the two are
 * independent from that point on - editing a KPI's capture setup or setup
 * text on this scorecard never changes the library entry, another
 * department's placement, or another year's copy, matching the reference
 * tool's per-scorecard KPI objects. The kpi_library_id link itself is kept
 * only for provenance/C88 tagging, not as a live data source. Ref code is
 * either supplied by the caller or auto-suggested by extending the
 * scorecard's existing ref-code pattern. Quarterly targets are intentionally
 * left unset here - that's a separate step in Scorecard Setup, not part of
 * placing a KPI on the scorecard.
 */
export async function addLibraryKpisToScorecard(
  scorecardId: string,
  items: { libraryId: string; refCode?: string }[]
): Promise<{ added: number; skipped: string[] }> {
  if (!scorecardId || items.length === 0) return { added: 0, skipped: [] };

  const supabase = await createClient();

  const { data: scorecardRaw, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org_id")
    .eq("id", scorecardId)
    .maybeSingle();
  if (scErr) throw new Error(scErr.message);
  const scorecard = scorecardRaw as unknown as { id: string; org_id: string } | null;
  if (!scorecard) throw new Error("Scorecard not found.");

  const libraryIds = items.map((i) => i.libraryId);
  const { data: libRows, error: libErr } = await supabase
    .from("kpi_library")
    .select(
      "id, org_id, name, kpa, idp_ref, unit_of_measure, target_type, calc_config, method, kpi_type, wards, baseline, annual_target, poe"
    )
    .in("id", libraryIds);
  if (libErr) throw new Error(libErr.message);

  type LibRow = {
    id: string;
    org_id: string;
    name: string;
    kpa: string | null;
    idp_ref: string | null;
    unit_of_measure: string | null;
    target_type: string;
    calc_config: Record<string, unknown> | null;
    method: string | null;
    kpi_type: string | null;
    wards: string | null;
    baseline: string | null;
    annual_target: string | null;
    poe: string | null;
  };
  const byId = new Map(((libRows ?? []) as unknown as LibRow[]).map((r) => [r.id, r]));

  const { data: existingKpis, error: exErr } = await supabase
    .from("scorecard_kpis")
    .select("ref_code")
    .eq("scorecard_id", scorecardId);
  if (exErr) throw new Error(exErr.message);
  const existingCodes = ((existingKpis ?? []) as unknown as { ref_code: string | null }[]).map((r) => r.ref_code);

  const needsSuggestion = items.filter((i) => !i.refCode?.trim()).length;
  const suggestions = suggestNextRefCodes(existingCodes, needsSuggestion);
  let suggestionIdx = 0;

  const skipped: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const item of items) {
    const lib = byId.get(item.libraryId);
    if (!lib) {
      skipped.push(item.libraryId);
      continue;
    }
    if (lib.org_id !== scorecard.org_id) {
      skipped.push(lib.name);
      continue;
    }
    const refCode = item.refCode?.trim() || suggestions[suggestionIdx++] || null;
    rows.push({
      scorecard_id: scorecardId,
      kpi_library_id: lib.id,
      ref_code: refCode,
      name: lib.name,
      kpa: lib.kpa,
      idp_ref: lib.idp_ref,
      unit_of_measure: lib.unit_of_measure,
      target_type: lib.target_type,
      calc_config: lib.calc_config ?? {},
      method: lib.method,
      kpi_type: lib.kpi_type,
      wards: lib.wards,
      baseline: lib.baseline,
      annual_target: lib.annual_target,
      poe: lib.poe,
      weight: 0,
    });
  }

  if (rows.length === 0) return { added: 0, skipped };

  // Cast: same pragmatic workaround used for the kpi_results upsert in
  // scorecards/actions.ts - supabase-js's generic insert() overload
  // resolution doesn't hold up cleanly across postgrest-js versions.
  const { error } = await (
    supabase.from("scorecard_kpis") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}`);
  revalidatePath(`/scorecards/${scorecardId}/manage`);

  return { added: rows.length, skipped };
}

/**
 * Deletes one or more KPIs from a scorecard. kpi_targets and kpi_results
 * rows for each are removed automatically (both have ON DELETE CASCADE onto
 * scorecard_kpis), so no manual cleanup is needed - but that also means
 * this is irreversible, which is why the UI confirms before calling it.
 */
export async function deleteScorecardKpis(scorecardId: string, scorecardKpiIds: string[]): Promise<{ deleted: number }> {
  if (!scorecardId || scorecardKpiIds.length === 0) return { deleted: 0 };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("scorecard_kpis")
    .delete({ count: "exact" })
    .eq("scorecard_id", scorecardId)
    .in("id", scorecardKpiIds);
  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}`);
  revalidatePath(`/scorecards/${scorecardId}/manage`);

  return { deleted: count ?? scorecardKpiIds.length };
}

/**
 * Updates one KPI's own capture setup on this scorecard: its answer type
 * (calc_config.calc), accumulation (calc_config.acc - "none" | "cum" |
 * "carry", the reference tool's "Results across quarters" dropdown),
 * lower-is-better flag, and the 6 scorecard-setup narrative fields. This is
 * the first UI in the app that can write acc/lower at all - they used to be
 * frozen at whatever the original CSV migration set, since kpi_library's own
 * editor (KpiTypeForm) never exposed them either. Editing here only ever
 * touches this one scorecard_kpis row, matching the "each placement is its
 * own independent copy" model from kpi-admin-actions.ts's addLibraryKpisToScorecard.
 */
export async function updateScorecardKpiSetup(scorecardId: string, scorecardKpiId: string, formData: FormData) {
  const calcType = String(formData.get("calcType") ?? "").trim();
  const labels = String(formData.get("labels") ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const unit = String(formData.get("unit") ?? "").trim();
  const denRaw = String(formData.get("den") ?? "").trim();
  const x100 = formData.get("x100") === "on";
  const formula = String(formData.get("formula") ?? "").trim();
  const scaleRaw = String(formData.get("scale") ?? "").trim();
  const lower = formData.get("lower") === "on";
  const acc = String(formData.get("acc") ?? "none");

  const calc: Record<string, unknown> = { type: calcType || undefined };
  if (labels.length) calc.labels = labels;
  if (calcType === "single" && unit) calc.unit = unit;
  if (calcType === "ratio") {
    if (denRaw) calc.den = Number(denRaw);
    calc.x100 = x100;
    if (!x100 && unit) calc.unit = unit;
  }
  if (calcType === "three" && formula) calc.formula = formula;
  if (calcType === "rating") calc.scale = Number(scaleRaw) || 5;

  const textOrNull = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const supabase = await createClient();
  // Cast: same pragmatic workaround used throughout this data layer for
  // supabase-js's generic update() overload resolution.
  const { error } = await (
    supabase.from("scorecard_kpis") as unknown as {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
      };
    }
  )
    .update({
      calc_config: { calc, lower, acc },
      method: textOrNull("method"),
      kpi_type: textOrNull("kpiType"),
      wards: textOrNull("wards"),
      baseline: textOrNull("baseline"),
      annual_target: textOrNull("annualTarget"),
      poe: textOrNull("poe"),
    })
    .eq("id", scorecardKpiId)
    .eq("scorecard_id", scorecardId);
  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}/manage`);
  revalidatePath(`/scorecards/${scorecardId}`);
}
