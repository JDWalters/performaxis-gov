import type { AssessmentSummary as AssessmentSummaryData } from "@/lib/data/appraisals";

function fmt1(n: number | null): string {
  return n == null ? "—" : n.toFixed(2);
}

// Maps the band's tag class to a matching card border/background pair.
const BAND_CARD_CLASS: Record<string, string> = {
  "stag-blue": "border-blue bg-blue-bg",
  "stag-met": "border-met bg-met-bg",
  "stag-okk": "border-okk bg-okk-bg",
  "stag-almost": "border-almost bg-almost-bg",
  "stag-missed": "border-missed bg-missed-bg",
};

/**
 * The KPA Component / Competencies / Overall Weighted Score cards from the
 * client's reference "Assessments" screen - final-rating-weighted rollup of
 * this quarter's KPI ratings (80%) and competency ratings (20%) into a
 * single 1-5 score, banded into the 5 Reg-17-Jan-2014 performance tiers.
 */
export function AssessmentSummary({ assessment }: { assessment: AssessmentSummaryData }) {
  const { kpa, competencies, overall } = assessment;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <ScoreCard
        label={`KPA Component (${kpa.weightPct}%)`}
        score={kpa.score}
        subtitle={`${kpa.ratedCount} of ${kpa.totalCount} applicable indicators rated`}
      />
      <ScoreCard
        label={`Competencies (${competencies.weightPct}%)`}
        score={competencies.score}
        subtitle={`${competencies.ratedCount} of ${competencies.totalCount} rated`}
      />
      <div
        className={`rounded-xl border-2 p-4 ${
          overall.band ? BAND_CARD_CLASS[overall.band.tagClass] : "border-line bg-white"
        }`}
      >
        <div className="text-xs font-bold uppercase tracking-wide text-ink2">
          Overall weighted score
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-ink">{fmt1(overall.score)}</span>
          <span className="text-sm font-semibold text-ink2">/5</span>
        </div>
        <div className="mt-1 text-xs text-ink2">
          {overall.band?.label ?? "Not yet rated"}
          {overall.percentOfStandard != null && ` · ${Math.round(overall.percentOfStandard)}% of standard`}
        </div>
        {overall.bonus && (
          <div className="mt-2 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            Bonus eligible · {overall.bonus.range}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  subtitle,
}: {
  label: string;
  score: number | null;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-ink2">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-ink">{fmt1(score)}</span>
        <span className="text-sm font-semibold text-ink2">/5</span>
      </div>
      <div className="mt-1 text-xs text-ink2">{subtitle}</div>
    </div>
  );
}
