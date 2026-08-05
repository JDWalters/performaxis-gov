/**
 * SDBIP 5-tier achievement classification, ported line-for-line from the
 * client's reference prototype (index (1).html: parseNum/statusFor/cumOf/
 * effectiveMidyear) so the real dashboard's bands and thresholds match
 * theirs exactly. Pure module - no framework imports.
 */

export type Status = "blue" | "met" | "almost" | "missed" | "pending";

export const STATUS_META: Record<Status, { label: string; tagClass: string }> = {
  blue: { label: "Well achieved", tagClass: "stag-blue" },
  met: { label: "Achieved", tagClass: "stag-met" },
  almost: { label: "Almost achieved", tagClass: "stag-almost" },
  missed: { label: "Not achieved", tagClass: "stag-missed" },
  pending: { label: "Not yet reportable", tagClass: "stag-pending" },
};

/** Parses a captured/target string like "80.78%", "R 1 000 000", "N/A" into a number, or null/na flags. */
export function parseNum(raw: string | null | undefined): { num: number | null; na: boolean } {
  if (raw == null) return { num: null, na: false };
  const s = String(raw).trim();
  if (!s) return { num: null, na: false };
  if (/^n\/?a$/i.test(s)) return { num: null, na: true };
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const num = cleaned === "" || cleaned === "-" ? null : Number(cleaned);
  return { num: Number.isFinite(num as number) ? num : null, na: false };
}

/**
 * Classifies one captured result against its target into one of 5 bands.
 * Mirrors statusFor() exactly: blue >=115% of target (<=85% if lower-is-better),
 * met >=100% (<=100%), almost >=95% (<=105%), else missed. A target of "N/A",
 * an unparseable target, or an unparseable/absent result is "pending". When
 * the target parses to 0 (or negative), there's no blue/almost tier - it
 * collapses to a plain met/missed comparison.
 */
export function statusFor(
  resultStr: string | null | undefined,
  targetStr: string | null | undefined,
  lower: boolean
): Status {
  const tgt = parseNum(targetStr);
  if (tgt.na) return "pending";
  const res = parseNum(resultStr);
  if (res.num === null || tgt.num === null) return "pending";
  const r = res.num;
  const t = tgt.num;

  if (lower) {
    if (t > 0) {
      if (r <= t * 0.85) return "blue";
      if (r <= t) return "met";
      if (r <= t * 1.05) return "almost";
      return "missed";
    }
    return r <= t ? "met" : "missed";
  }

  if (t > 0) {
    if (r >= t * 1.15) return "blue";
    if (r >= t) return "met";
    if (r >= t * 0.95) return "almost";
    return "missed";
  }
  return r >= t ? "met" : "missed";
}

export type StatusTally = Record<Status, number>;

export function emptyTally(): StatusTally {
  return { blue: 0, met: 0, almost: 0, missed: 0, pending: 0 };
}

/** % achieved (blue+met) of applicable (non-pending) KPIs - null if nothing is applicable yet. */
export function pctOf(t: StatusTally): number | null {
  const applicable = t.blue + t.met + t.almost + t.missed;
  return applicable ? Math.round(((t.blue + t.met) / applicable) * 100) : null;
}

export type Accumulation = "standalone" | "cum" | "carry";

export function accOf(acc: string | null | undefined): Accumulation {
  if (acc === "cum") return "cum";
  if (acc === "carry") return "carry";
  return "standalone";
}

/**
 * The KPI's "effective" captured value as of quarter index `q` (0-based),
 * applying its accumulation rule:
 *  - standalone: that quarter's own captured value.
 *  - cum: running total of every quarter's value from Q1 through q (the
 *    figure captured each quarter is already meant to be read as-typed and
 *    summed, matching cumOf() in the reference).
 *  - carry: that quarter's value if captured, else the most recent prior
 *    quarter's value (a captured "yes"/count carries forward until re-set).
 * Returns null if nothing is available yet at or before this checkpoint.
 */
export function effectiveValue(actuals: (string | null)[], q: number, acc: Accumulation): number | null {
  if (acc === "cum") {
    let total = 0;
    let any = false;
    for (let i = 0; i <= q; i++) {
      const p = parseNum(actuals[i]);
      if (p.num !== null) {
        total += p.num;
        any = true;
      }
    }
    return any ? total : null;
  }
  if (acc === "carry") {
    for (let i = q; i >= 0; i--) {
      const p = parseNum(actuals[i]);
      if (p.num !== null) return p.num;
    }
    return null;
  }
  return parseNum(actuals[q]).num;
}

export type Trend = "improving" | "declining" | "unchanged" | "insufficient";

export const TREND_META: Record<Trend, { label: string; icon: string; className: string }> = {
  improving: { label: "improving", icon: "▲", className: "text-met" },
  declining: { label: "declining", icon: "▼", className: "text-missed" },
  unchanged: { label: "unchanged", icon: "—", className: "text-ink2" },
  insufficient: { label: "insufficient data", icon: "—", className: "text-ink2" },
};

// Ordinal ranking of the 5 status tiers, used to compare two quarters'
// achievement direction-aware (a lower-is-better KPI's statusFor() already
// flips blue/met/almost/missed to the correct side, so ranking the tier
// itself - rather than the raw captured number - keeps "improving" meaning
// "moved toward a better tier" for both higher- and lower-is-better KPIs).
const STATUS_RANK: Record<Status, number | null> = { blue: 3, met: 2, almost: 1, missed: 0, pending: null };

/**
 * Trend direction from a sequence of quarterly values (already in
 * "higher is better" terms - either a plain percentage, or a status tier
 * rank). Compares the last two non-null entries in the sequence, skipping
 * gaps (e.g. Q1/Q2 blank, Q3/Q4 captured compares Q3 vs Q4). Needs at least
 * two reportable points, otherwise "insufficient".
 */
export function trendOf(values: (number | null)[]): Trend {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return "insufficient";
  const [prev, curr] = pts.slice(-2);
  if (curr > prev) return "improving";
  if (curr < prev) return "declining";
  return "unchanged";
}

/** Trend across a sequence of quarterly statuses, using tier rank (direction-aware for lower-is-better KPIs). */
export function trendOfStatuses(statuses: Status[]): Trend {
  return trendOf(statuses.map((s) => STATUS_RANK[s]));
}

export type Period = 1 | 2 | 3 | 4 | "mid" | "annual";

/**
 * Resolves a period selector (a single quarter, "mid" = as-of-Q2, or
 * "annual" = as-of-Q4) to the checkpoint quarter index and target to
 * compare against - mid-year/annual reuse the same accumulation-aware
 * "effective value as of this checkpoint" logic as a single quarter, just
 * anchored at Q2 or Q4 instead of the currently-selected quarter.
 */
export function statusForPeriod(
  actuals: (string | null)[],
  targets: (string | null)[],
  lower: boolean,
  acc: Accumulation,
  period: Period
): Status {
  const q = period === "mid" ? 1 : period === "annual" ? 3 : period - 1;
  const value = effectiveValue(actuals, q, acc);
  const target = targets[q];
  if (value === null) return statusFor(null, target, lower);
  return statusFor(String(value), target, lower);
}
