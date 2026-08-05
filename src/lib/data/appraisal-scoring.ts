/**
 * Pure scoring engine for the EPAS "Assessments" screen - the KPA Component /
 * Competencies / Overall Weighted Score cards, ported from the client's
 * reference prototype (index.html, kpaScore/compScore/overallScore/bandOf/
 * bonusBand). No framework imports - safe to use from server data layers or
 * client components alike.
 *
 * Scoring rules (as implemented in the reference app):
 *  - Each KPI and each competency gets a "final rating" of panel rating if
 *    present, else manager rating. Self-ratings are informational only and
 *    never count toward the score.
 *  - KPA Component: KPI final ratings weighted by each KPI's configured
 *    weight (appraisal_kpis.weight), rebased to 100% among only the KPIs
 *    that have both a weight and a final rating (N/A-flagged or unrated
 *    KPIs drop out rather than dragging the average down).
 *  - Competencies: the 12 competencies (6 Core + 6 Leading) weighted
 *    equally, rebased to 100% among the ones with a final rating.
 *  - Overall = (kpaScore*wKpa + compScore*wComp) / (wKpa+wComp), defaulting
 *    to 80/20, degrading gracefully to whichever side has data if the other
 *    has none.
 */

export function finalRating(
  self: number | null,
  mgr: number | null,
  panel: number | null
): number | null {
  return panel ?? mgr ?? self ?? null;
}

export type WeightedItem = { rating: number | null; weight: number };

export type PartialScore = {
  score: number | null;
  ratedCount: number;
  totalCount: number;
};

/** Weighted average of rated items, weights rebased to 100% among the rated ones. */
export function weightedScore(items: WeightedItem[]): PartialScore {
  const rated = items.filter((i) => i.rating != null && i.weight > 0);
  const totalWeight = rated.reduce((sum, i) => sum + i.weight, 0);
  const score =
    totalWeight > 0
      ? rated.reduce((sum, i) => sum + i.rating! * i.weight, 0) / totalWeight
      : null;
  return { score, ratedCount: rated.length, totalCount: items.length };
}

/** Simple (equally-weighted) average of rated items. */
export function simpleScore(ratings: (number | null)[]): PartialScore {
  const rated = ratings.filter((r): r is number => r != null);
  const score = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  return { score, ratedCount: rated.length, totalCount: ratings.length };
}

export function overallScore(
  kpaScore: number | null,
  compScore: number | null,
  wKpa = 0.8,
  wComp = 0.2
): number | null {
  if (kpaScore == null && compScore == null) return null;
  if (kpaScore == null) return compScore;
  if (compScore == null) return kpaScore;
  return (kpaScore * wKpa + compScore * wComp) / (wKpa + wComp);
}

export type ScoreBand = { label: string; tagClass: string };
export type RatingScaleTerm = { r: number; term: string };

// Matches the seeded policy_templates row ("SA Municipal (MSA/MFMA)").
// Fetched live from the database where possible - these are just the fallback
// if that policy config is ever missing, so the app never breaks silently.
export const DEFAULT_RATING_SCALE: RatingScaleTerm[] = [
  { r: 5, term: "Outstanding performance" },
  { r: 4, term: "Significantly above expectations" },
  { r: 3, term: "Fully effective" },
  { r: 2, term: "Not fully effective" },
  { r: 1, term: "Unacceptable performance" },
];

const BAND_TAG_CLASS: Record<number, string> = {
  5: "stag-blue",
  4: "stag-met",
  3: "stag-okk",
  2: "stag-almost",
  1: "stag-missed",
};

/** 5-tier performance band on a 1-5 rating scale, using the org's configured rating-scale terminology. */
export function bandOf(
  score: number | null,
  scale: RatingScaleTerm[] = DEFAULT_RATING_SCALE
): ScoreBand | null {
  if (score == null) return null;
  const tier = score >= 4.5 ? 5 : score >= 3.5 ? 4 : score >= 2.5 ? 3 : score >= 1.5 ? 2 : 1;
  const term = scale.find((s) => s.r === tier)?.term ?? DEFAULT_RATING_SCALE[5 - tier].term;
  return { label: term, tagClass: BAND_TAG_CLASS[tier] };
}

/** Score expressed as a % of standard (3/5 = 100% of standard). */
export function percentOfStandard(score: number | null): number | null {
  if (score == null) return null;
  return (score / 3) * 100;
}

export type BonusBand = { from: number; to: number; pay: string };
export type BonusEligibility = { range: string } | null;

// Matches the seeded policy_templates row.
export const DEFAULT_BONUS_BANDS: BonusBand[] = [
  { from: 130, to: 149, pay: "5% - 9%" },
  { from: 150, to: 9999, pay: "10% - 14%" },
];

/** Bonus-eligibility band from % of standard, using the org's configured bands - null when not eligible. */
export function bonusEligibility(
  score: number | null,
  bands: BonusBand[] = DEFAULT_BONUS_BANDS
): BonusEligibility {
  const pct = percentOfStandard(score);
  if (pct == null) return null;
  const hit = [...bands].sort((a, b) => b.from - a.from).find((b) => pct >= b.from && pct <= b.to);
  return hit ? { range: hit.pay } : null;
}
