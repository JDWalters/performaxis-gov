import { bandKey, type EpasBandKey } from "@/lib/data/appraisal-scoring";
import type { EpasTally } from "@/lib/data/epas-dashboard";

/**
 * EPAS-specific sibling of scorecards/DashboardCharts.tsx. SDBIP's charts are
 * hardcoded to the 5-tier Status type (blue/met/almost/missed/pending); EPAS
 * bands an *employee's* overall weighted score on a 6-key scale that adds
 * "okk" (Fully effective) between met and almost - the reference tool's
 * bandOf() tiers 5..1 plus "not assessed" - so it needs its own small set of
 * chart primitives rather than force-fitting the SDBIP ones.
 */

const ORDER: EpasBandKey[] = ["blue", "met", "okk", "almost", "missed", "pending"];
const COLOR_VAR: Record<EpasBandKey, string> = {
  blue: "var(--color-blue)",
  met: "var(--color-met)",
  okk: "var(--color-okk)",
  almost: "var(--color-almost)",
  missed: "var(--color-missed)",
  pending: "var(--color-pending)",
};
const LABEL: Record<EpasBandKey, string> = {
  blue: "Outstanding",
  met: "Above expectations",
  okk: "Fully effective",
  almost: "Not fully effective",
  missed: "Unacceptable",
  pending: "Not assessed",
};

function total(t: EpasTally): number {
  return ORDER.reduce((sum, k) => sum + t[k], 0);
}

/** Horizontal stacked bar showing the 6-tier band breakdown, with a text legend below. */
export function EpasStatusBar({ tally, dark = false }: { tally: EpasTally; dark?: boolean }) {
  const t = total(tally);
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex h-3 w-full overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-paper"}`}>
        {t === 0 ? (
          <div className="h-full w-full" style={{ background: COLOR_VAR.pending }} />
        ) : (
          ORDER.map((k) =>
            tally[k] > 0 ? <div key={k} style={{ width: `${(tally[k] / t) * 100}%`, background: COLOR_VAR[k] }} /> : null
          )
        )}
      </div>
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium sm:text-sm ${dark ? "text-white/90" : "text-ink2"}`}
      >
        {ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COLOR_VAR[k] }} />
            {LABEL[k]} {tally[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The big "X.XX / 5" callout - EPAS scores are a weighted average on the 1-5 rating scale, not a percentage. */
export function EpasBigScore({ score, caption, dark = false }: { score: number | null; caption: string; dark?: boolean }) {
  return (
    <div>
      <div className={`text-4xl font-extrabold leading-none sm:text-5xl ${dark ? "text-white" : "text-ink"}`}>
        {score == null ? "—" : score.toFixed(2)}
        <span className={`ml-1 text-lg font-semibold ${dark ? "text-white/50" : "text-ink2"}`}>/5</span>
      </div>
      <div className={`mt-1.5 text-sm ${dark ? "text-white/70" : "text-ink2"}`}>{caption}</div>
    </div>
  );
}

/**
 * A single quarter's score, band-tinted - the reference's per-employee
 * `<td class="c mini2 {band}">` cells in the Q1-Q4 columns of the employees
 * table.
 */
export function EpasMiniCell({ score }: { score: number | null }) {
  return (
    <span className={`stag ${SCORE_TAG_CLASS[bandKey(score)]}`}>{score == null ? "—" : score.toFixed(1)}</span>
  );
}

const SCORE_TAG_CLASS: Record<EpasBandKey, string> = {
  blue: "stag-blue",
  met: "stag-met",
  okk: "stag-okk",
  almost: "stag-almost",
  missed: "stag-missed",
  pending: "stag-pending",
};

/** Horizontal score-out-of-5 bar per KPA, for the "Average score by Key Performance Area" panel. */
export function EpasKpaBar({ score }: { score: number | null }) {
  const pct = score == null ? 0 : (score / 5) * 100;
  const color = COLOR_VAR[bandKey(score)];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
