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
  lower: boolean;
  calc: KpiCalc | null;
  /** Raw accumulation code ("none" | "cum" | "carry") for this KPI's placement on this scorecard - independent per department/year. Use accOf() from sdbip-status.ts to normalise. */
  acc: string | null;
  // Scorecard-setup narrative fields, per placement (not shared via
  // kpi_library) so "+Year" can set baseline independently per year.
  method: string | null;
  kpiType: string | null;
  wards: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
  /** The kpi_library row this scorecard row was copied from, if any - used to detect "already on this scorecard" when offering more library KPIs to add. */
  libraryId: string | null;
  /** The Circular 88 code this KPI was created from, if any - drives the "C88: <code>" tag shown wherever the KPI appears. */
  c88Code: string | null;
  result: {
    actual: string | null;
    inputs: Record<string, unknown>;
    evidenceUrl: string | null;
    evidenceDescription: string | null;
    comment: string | null;
    correctiveAction: string | null;
    correctiveActionOwner: string | null;
    correctiveActionDue: string | null;
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

/**
 * Suggests the next N ref codes by extending whatever alphabetic-prefix +
 * number pattern already dominates a scorecard's existing codes (e.g.
 * "CMS1".."CMS5" -> next suggestions "CMS6", "CMS7"). Ignores decimal-suffixed
 * codes like "CMS5.1" for picking the prefix/max, but they don't collide with
 * suggestions either way since suggestions are always bare integers. Returns
 * null entries when no consistent prefix exists (e.g. an empty scorecard) -
 * the admin can still type a ref code in by hand.
 */
export function suggestNextRefCodes(existing: (string | null)[], count: number): (string | null)[] {
  const prefixCounts = new Map<string, number>();
  let maxNum = 0;
  for (const code of existing) {
    if (!code) continue;
    const m = code.trim().match(/^([A-Za-z]+)(\d+)/);
    if (!m) continue;
    prefixCounts.set(m[1], (prefixCounts.get(m[1]) ?? 0) + 1);
    maxNum = Math.max(maxNum, Number(m[2]));
  }
  let prefix: string | null = null;
  let best = 0;
  for (const [p, c] of prefixCounts) {
    if (c > best) {
      best = c;
      prefix = p;
    }
  }
  if (!prefix) return Array.from({ length: count }, () => null);
  return Array.from({ length: count }, (_, i) => `${prefix}${maxNum + i + 1}`);
}
