"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/scorecards";
import { computeCalcResult } from "@/lib/data/kpi-calc-shared";

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
  const evidenceDescription = String(formData.get("evidenceDescription") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const correctiveAction = String(formData.get("correctiveAction") ?? "").trim();
  const correctiveActionOwner = String(formData.get("correctiveActionOwner") ?? "").trim();
  const correctiveActionDue = String(formData.get("correctiveActionDue") ?? "").trim();

  if (!scorecardKpiId || !quarter) {
    throw new Error("Missing scorecard KPI or quarter.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: kpiRow, error: kpiErr } = await supabase
    .from("scorecard_kpis")
    .select("calc_config")
    .eq("id", scorecardKpiId)
    .maybeSingle();
  if (kpiErr) throw kpiErr;

  const calc =
    ((kpiRow as unknown as { calc_config: { calc?: KpiCalc } | null } | null)?.calc_config?.calc as
      | KpiCalc
      | undefined) ?? null;

  const { actual, inputs } = computeCalcResult(calc, (key) => String(formData.get(key) ?? ""));

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
        evidence_description: evidenceDescription || null,
        comment: comment || null,
        corrective_action: correctiveAction || null,
        corrective_action_owner: correctiveActionOwner || null,
        corrective_action_due: correctiveActionDue || null,
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
