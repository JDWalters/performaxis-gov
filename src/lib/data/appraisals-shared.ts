/**
 * Types and pure helpers shared between the server data layer (appraisals.ts)
 * and client components (AppraisalCaptureCard.tsx). No @/lib/supabase/server
 * import here, same reason as scorecards-shared.ts.
 *
 * This pass covers capturing a KPI's own "actual" result (via the same 5-type
 * calc engine as SDBIP). The separate self/manager/panel 1-5 assessment
 * workflow (self_rating/mgr_rating/panel_rating) is read-only here - it's a
 * materially different, multi-person sign-off feature that isn't part of this
 * build yet.
 */
import type { KpiCalc } from "@/lib/data/kpi-calc-shared";
import { friendlyActualValue, needsReview } from "@/lib/data/kpi-calc-shared";

export type { KpiCalc, CalcType, ComputedResult } from "@/lib/data/kpi-calc-shared";
export { CALC_TYPES, computeCalcResult, friendlyActualValue, needsReview } from "@/lib/data/kpi-calc-shared";

export type AppraisalKpi = {
  id: string;
  name: string;
  kpa: string | null;
  unitOfMeasure: string | null;
  weight: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
  calc: KpiCalc | null;
  result: {
    actual: string | null;
    inputs: Record<string, unknown>;
    targetValue: string | null;
    na: boolean;
    evidenceUrl: string | null;
    comment: string | null;
    correctiveAction: string | null;
    selfRating: number | null;
    mgrRating: number | null;
    panelRating: number | null;
  } | null;
};

export function friendlyAppraisalActual(kpi: AppraisalKpi): string | null {
  return friendlyActualValue(kpi.result?.actual, kpi.calc);
}

/** True when this KPI's captured result predates its answer type and needs re-capturing. */
export function appraisalKpiNeedsReview(kpi: AppraisalKpi): boolean {
  return needsReview(kpi.result?.actual, kpi.calc);
}
