/**
 * Types and pure helpers shared between the server data layer (scorecards.ts)
 * and client components (e.g. KpiCaptureCard.tsx). Deliberately has no
 * imports from @/lib/supabase/server - that module pulls in next/headers,
 * which breaks the build the moment a client component imports it
 * transitively.
 *
 * The actual calc-type engine (the 5 answer types + computeCalcResult) lives
 * in kpi-calc-shared.ts, shared with EPAS appraisals - this file re-exports
 * it plus the scorecard-specific CaptureKpi shape.
 */
import type { KpiCalc } from "@/lib/data/kpi-calc-shared";
import { friendlyActualValue, needsReview } from "@/lib/data/kpi-calc-shared";

export type { KpiCalc, CalcType, ComputedResult } from "@/lib/data/kpi-calc-shared";
export { CALC_TYPES, computeCalcResult, friendlyActualValue, needsReview } from "@/lib/data/kpi-calc-shared";

export type CaptureKpi = {
  id: string;
  refCode: string | null;
  name: string;
  kpa: string | null;
  unitOfMeasure: string | null;
  targetType: string;
  target: string | null;
  calc: KpiCalc | null;
  result: {
    actual: string | null;
    inputs: Record<string, unknown>;
    evidenceUrl: string | null;
    comment: string | null;
    correctiveAction: string | null;
  } | null;
};

/** Friendly label for the canonical stored value - display only, never stored. */
export function friendlyActual(kpi: CaptureKpi): string | null {
  return friendlyActualValue(kpi.result?.actual, kpi.calc);
}

/** True when this KPI's captured result predates its answer type and needs re-capturing. */
export function kpiNeedsReview(kpi: CaptureKpi): boolean {
  return needsReview(kpi.result?.actual, kpi.calc);
}
