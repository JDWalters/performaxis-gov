/**
 * The five KPI answer types PerformAxis supports, and the pure logic for
 * turning a capturer's raw input(s) into a canonical stored "actual" value.
 * Shared between SDBIP scorecards and EPAS appraisals (both kpi_library and
 * appraisal_kpis carry a calc_config with this same shape) and between server
 * actions and client components - no framework imports here on purpose.
 *
 *  - yesno:  a single Yes/No choice, stored as "1" or "0".
 *  - single: one number, stored as typed (a count, an amount, a pre-computed %).
 *  - ratio:  two numbers (numerator/denominator, one may be fixed), stored as
 *            the computed percentage or ratio.
 *  - three:  three numbers combined via a named formula, stored as the result.
 *  - rating: a score on a fixed scale (default 1-5), stored as the number.
 */
export type CalcType = "yesno" | "single" | "ratio" | "three" | "rating";

export const CALC_TYPES: { value: CalcType; label: string }[] = [
  { value: "yesno", label: "Yes / No" },
  { value: "single", label: "Count / number" },
  { value: "ratio", label: "Ratio / percentage" },
  { value: "three", label: "Formula (3 inputs)" },
  { value: "rating", label: "Rating scale" },
];

export type KpiCalc = {
  type: CalcType | string;
  labels?: string[];
  x100?: boolean;
  den?: number;
  unit?: string;
  formula?: string;
  scale?: number;
};

export type ComputedResult = { actual: string | null; inputs: Record<string, unknown> };

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/**
 * Computes the canonical stored `actual` + raw `inputs` from a capturer's
 * submitted fields, branching on calc.type. `get` reads one named field
 * (backed by FormData server-side or component state client-side).
 */
export function computeCalcResult(calc: KpiCalc | null, get: (key: string) => string): ComputedResult {
  const type = calc?.type;

  if (type === "yesno") {
    const answer = get("answer").trim();
    return { actual: answer === "1" || answer === "0" ? answer : null, inputs: {} };
  }

  if (type === "rating") {
    const scale = calc?.scale ?? 5;
    const raw = get("rating").trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 1 || n > scale) return { actual: null, inputs: {} };
    return { actual: String(Math.round(n)), inputs: { rating: n } };
  }

  if (type === "single") {
    const value = get("value").trim();
    return { actual: value || null, inputs: value ? { value } : {} };
  }

  if (type === "ratio") {
    const numeratorRaw = get("numerator").trim();
    const numerator = Number(numeratorRaw.replace(",", "."));
    const denominator = calc?.den ?? Number(get("denominator").replace(",", "."));
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
    const a = Number(get("a").replace(",", "."));
    const b = Number(get("b").replace(",", "."));
    const c = Number(get("c").replace(",", "."));
    if (![a, b, c].every(Number.isFinite) || c === 0) return { actual: null, inputs: {} };
    // Only known formula shape in the migrated data today - not a general
    // expression evaluator by design, to avoid running arbitrary formula text.
    const result = calc?.formula === "(a-b)/c" ? (a - b) / c : null;
    return { actual: result === null ? null : formatNumber(result), inputs: { a, b, c } };
  }

  // No recognised calc type - keep the old free-text fallback.
  const actual = get("actual").trim();
  return { actual: actual || null, inputs: {} };
}

/** Friendly label for a stored canonical value - display only, never stored. */
export function friendlyActualValue(actual: string | null | undefined, calc: KpiCalc | null): string | null {
  if (!actual) return null;
  if (calc?.type === "yesno") {
    return actual === "1" ? "Achieved" : actual === "0" ? "Not achieved" : actual;
  }
  if (calc?.type === "rating") {
    return `${actual} / ${calc.scale ?? 5}`;
  }
  return actual;
}

// A bare number, comma or dot decimal, optional trailing % or a single unit word
// (e.g. "45.5%", "0,04", "3.2 months", "12"). Anything else - narrative text like
// "Submitted on time" or "Error in claculation" - was typed before this KPI had a
// structured answer type and needs a human to re-capture it properly.
const CANONICAL_VALUE_RE = /^-?[0-9]+([.,][0-9]+)?\s*%?[a-zA-Z]*$/;

/**
 * True when a stored `actual` doesn't match what this KPI's calc.type expects -
 * a legacy free-text value captured before the type-aware form existed. Used to
 * surface a "needs review" flag instead of silently hiding (yesno/ratio/three)
 * or quietly showing (single) an un-parseable historic value.
 */
export function needsReview(actual: string | null | undefined, calc: KpiCalc | null): boolean {
  if (!actual) return false;
  const type = calc?.type;
  const value = actual.trim();

  if (type === "yesno") return value !== "1" && value !== "0";

  if (type === "rating") {
    const scale = calc?.scale ?? 5;
    const n = Number(value);
    return !(Number.isFinite(n) && n >= 1 && n <= scale && String(Math.round(n)) === value);
  }

  // single / ratio / three / no calc type yet - all store a plain formatted number.
  return !CANONICAL_VALUE_RE.test(value);
}
