import Link from "next/link";
import { redirect } from "next/navigation";
import { getScorecardsList } from "@/lib/data/scorecards";
import { getActiveFinancialYear } from "@/lib/data/financial-years";

/**
 * "Capture Scorecards" landing - a real, static route (not the `[id]`
 * dynamic segment), so it's reachable as its own sidebar destination without
 * colliding with `/scorecards/[id]` the way `/scorecards/capture` used to
 * before this route existed (Next prioritises a static sibling over a
 * dynamic one, so this file wins outright).
 *
 * With exactly one scorecard in view (the common case for a department-level
 * user) this skips the picker entirely and drops straight into that
 * scorecard's capture view - there's nothing to choose between. With more
 * than one (a municipality-level or platform-admin view) it shows a picker
 * grid instead, same card layout as the "by department" breakdown on the
 * SDBIP dashboard, sorted so scorecards needing review surface first.
 */
export default async function CaptureScorecardsPage() {
  const activeFy = await getActiveFinancialYear();
  const scorecards = await getScorecardsList(activeFy.selected?.id ?? null);

  if (scorecards.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold text-ink">Capture Scorecards</h1>
        <p className="text-sm text-ink2">No scorecards are in view for this financial year yet.</p>
      </div>
    );
  }

  if (scorecards.length === 1) {
    redirect(`/scorecards/${scorecards[0].scorecardId}`);
  }

  const sorted = [...scorecards].sort((a, b) => b.needsReviewCount - a.needsReviewCount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Capture Scorecards</h1>
        <p className="mt-1 text-sm text-ink2">Choose a scorecard to capture results against.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => (
          <Link
            key={s.scorecardId}
            href={`/scorecards/${s.scorecardId}`}
            className="rounded-xl border border-line bg-white p-4 transition hover:border-gold"
          >
            <div className="text-sm font-semibold text-ink">{s.orgName}</div>
            <div className="mt-1 text-xs text-ink2">{s.kpiCount} KPIs</div>
            {s.needsReviewCount > 0 && (
              <span className="mt-2 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                {s.needsReviewCount} need review
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
