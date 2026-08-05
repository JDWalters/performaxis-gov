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

/** 5-tier performance band on a 1-5 rating scale. */
export function bandOf(score: number | null): ScoreBand | null {
  if (score == null) return null;
  if (score >= 4.5) return { label: "Outstanding", tagClass: "stag-blue" };
  if (score >= 3.5) return { label: "Significantly above expectations", tagClass: "stag-met" };
  if (score >= 2.5) return { label: "Fully effective", tagClass: "stag-okk" };
  if (score >= 1.5) return { label: "Not fully effective", tagClass: "stag-almost" };
  return { label: "Unacceptable", tagClass: "stag-missed" };
}

/** Score expressed as a % of standard (3/5 = 100% of standard). */
export function percentOfStandard(score: number | null): number | null {
  if (score == null) return null;
  return (score / 3) * 100;
}

export type BonusEligibility = { range: string } | null;

/** Bonus-eligibility band from % of standard - null when not eligible. */
export function bonusEligibility(score: number | null): BonusEligibility {
  const pct = percentOfStandard(score);
  if (pct == null) return null;
  if (pct >= 150) return { range: "10–14%" };
  if (pct >= 130) return { range: "5–9%" };
  return null;
}
