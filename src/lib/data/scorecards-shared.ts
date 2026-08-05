/**
 * Types and pure helpers shared between the server data layer (scorecards.ts)
 * and client components (e.g. KpiCaptureCard.tsx). Deliberately has no
 * imports from @/lib/supabase/server - that module pulls in next/headers,
 * which breaks the build the moment a client component imports it
 * transitively.
 */

/**
 * Mirrors the "calc" object inside kpi_library.calc_config, migrated from the
 * legacy SDBIP register. Drives which capture inputs the form shows instead of
 * one free-text box for every KPI, e.g. a Yes/No selector for "yesno" KPIs
 * rather than someone typing "1 (Achieved)".
 */
export type KpiCalc = {
  type: "yesno" | "single" | "ratio" | "three" | string;
  labels?: string[];
  x100?: boolean;
  den?: number;
  unit?: string;
  formula?: string;
};

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
  const actual = kpi.result?.actual;
  if (!actual) return null;
  if (kpi.calc?.type === "yesno") {
    return actual === "1" ? "Achieved" : actual === "0" ? "Not achieved" : actual;
  }
  return actual;
}
