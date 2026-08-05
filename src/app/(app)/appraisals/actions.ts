"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/appraisals";
import { computeCalcResult } from "@/lib/data/kpi-calc-shared";

/**
 * Upserts one quarter's appraisal KPI result (the employee's own "actual",
 * captured via the same calc-type engine as SDBIP scorecards). Does not
 * touch self_rating/mgr_rating/panel_rating - that multi-person sign-off
 * workflow is separate and not part of this capture form.
 * RLS (aratings_insert/aratings_update, via has_employee_access) is the real
 * gatekeeper - this only succeeds if the signed-in user has
 * capture_appraisal_ratings on the employee.
 */
export async function saveAppraisalResult(formData: FormData) {
  const cycleId = String(formData.get("cycleId") ?? "");
  const appraisalKpiId = String(formData.get("appraisalKpiId") ?? "");
  const quarter = Number(formData.get("quarter"));
  const evidenceUrl = String(formData.get("evidenceUrl") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const correctiveAction = String(formData.get("correctiveAction") ?? "").trim();

  if (!appraisalKpiId || !quarter) {
    throw new Error("Missing appraisal KPI or quarter.");
  }

  const supabase = await createClient();

  const { data: kpiRow, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select("calc_config")
    .eq("id", appraisalKpiId)
    .maybeSingle();
  if (kpiErr) throw kpiErr;

  const calc =
    ((kpiRow as unknown as { calc_config: { calc?: KpiCalc } | null } | null)?.calc_config
      ?.calc as KpiCalc | undefined) ?? null;

  const { actual, inputs } = computeCalcResult(calc, (key) => String(formData.get(key) ?? ""));

  // Cast: same pragmatic workaround as the upsert cast in scorecards/actions.ts.
  const { error } = await (
    supabase.from("appraisal_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(
    [
      {
        appraisal_kpi_id: appraisalKpiId,
        quarter,
        actual,
        inputs,
        evidence_url: evidenceUrl || null,
        comment: comment || null,
        corrective_action: correctiveAction || null,
      },
    ],
    { onConflict: "appraisal_kpi_id,quarter" }
  );

  if (error) throw error;

  if (cycleId) {
    revalidatePath(`/appraisals/${cycleId}`);
  }
}
