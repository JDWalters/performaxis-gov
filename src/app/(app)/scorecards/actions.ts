"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/scorecards";

/** Formats a computed ratio/three-input result the same way for storage and display. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/**
 * Turns the structured capture inputs (per calc.type) into the stored `actual`
 * string and the raw `inputs` JSON, so the field never holds a hand-typed
 * label like "1 (Achieved)" again - the label is derived in the UI from the
 * canonical value instead.
 */
function computeResult(
  calc: KpiCalc | null,
  formData: FormData
): { actual: string | null; inputs: Record<string, unknown> } {
  const type = calc?.type;

  if (type === "yesno") {
    const answer = String(formData.get("answer") ?? "").trim();
    return { actual: answer === "1" || answer === "0" ? answer : null, inputs: {} };
  }

  if (type === "single") {
    const value = String(formData.get("value") ?? "").trim();
    return { actual: value || null, inputs: value ? { value } : {} };
  }

  if (type === "ratio") {
    const numeratorRaw = String(formData.get("numerator") ?? "").trim();
    const numerator = Number(numeratorRaw.replace(",", "."));
    const denominator = calc?.den ?? Number(String(formData.get("denominator") ?? "").replace(",", "."));
    if (!numeratorRaw || !Number.isFinite(numerator) || !denominator) {
      return { actual: null, inputs: {} };
    }
    let result = numerator / denominator;
    if (calc?.x100) result *= 100;
    const suffix = calc?.x100 ? "%" : calc?.unit ? ` ${calc.unit}` : "";
    return {
      actual: `${formatNumber(result)}${suffix}`,
      inputs: calc?.den ? { numerator } : { numerator, denominator },
    };
  }

  if (type === "three") {
    const a = Number(String(formData.get("a") ?? "").replace(",", "."));
    const b = Number(String(formData.get("b") ?? "").replace(",", "."));
    const c = Number(String(formData.get("c") ?? "").replace(",", "."));
    if (![a, b, c].every(Number.isFinite) || c === 0) {
      return { actual: null, inputs: {} };
    }
    // Only known formula shape in the migrated data today - not a general
    // expression evaluator by design, to avoid running arbitrary formula text.
    const result = calc?.formula === "(a-b)/c" ? (a - b) / c : null;
    return {
      actual: result === null ? null : formatNumber(result),
      inputs: { a, b, c },
    };
  }

  // Fallback for KPIs with no recognised calc type - keep the old free-text box.
  const actual = String(formData.get("actual") ?? "").trim();
  return { actual: actual || null, inputs: {} };
}

/**
 * Upserts one quarter's KPI result. RLS (results_insert/results_update policies)
 * is the real gatekeeper here - this only succeeds if the signed-in user has
 * capture_kpi_results (or manage_scorecard_setup) on the KPI's department org.
 */
export async function saveKpiResult(formData: FormData) {
  const scorecardId = String(formData.get("scorecardId") ?? "");
  const scorecardKpiId = String(formData.get("scorecardKpiId") ?? "");
  const quarter = Number(formData.get("quarter"));
  const evidenceUrl = String(formData.get("evidenceUrl") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const correctiveAction = String(formData.get("correctiveAction") ?? "").trim();

  if (!scorecardKpiId || !quarter) {
    throw new Error("Missing scorecard KPI or quarter.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: kpiRow, error: kpiErr } = await supabase
    .from("scorecard_kpis")
    .select("kpi_library:kpi_library_id(calc_config)")
    .eq("id", scorecardKpiId)
    .maybeSingle();
  if (kpiErr) throw kpiErr;

  const calc =
    ((kpiRow as unknown as { kpi_library: { calc_config: { calc?: KpiCalc } | null } | null } | null)
      ?.kpi_library?.calc_config?.calc as KpiCalc | undefined) ?? null;

  const { actual, inputs } = computeResult(calc, formData);

  // Cast: supabase-js's generic upsert() overload resolution doesn't always
  // hold up across postgrest-js versions - this mirrors the same pragmatic
  // cast used for nested-select embedding elsewhere in this codebase.
  const { error } = await (
    supabase.from("kpi_results") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    [
      {
        scorecard_kpi_id: scorecardKpiId,
        quarter,
        actual,
        inputs,
        evidence_url: evidenceUrl || null,
        comment: comment || null,
        corrective_action: correctiveAction || null,
        submitted_by: user?.id ?? null,
        submitted_at: new Date().toISOString(),
      },
    ],
    { onConflict: "scorecard_kpi_id,quarter" }
  );

  if (error) throw error;

  if (scorecardId) {
    revalidatePath(`/scorecards/${scorecardId}`);
  }
}
