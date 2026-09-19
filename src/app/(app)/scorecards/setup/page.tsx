import Link from "next/link";
import { redirect } from "next/navigation";
import { getScorecardsList } from "@/lib/data/scorecards";
import { getActiveFinancialYear } from "@/lib/data/financial-years";

/**
 * "Setup Scorecards" landing - same picker-then-redirect pattern as
 * `/scorecards/capture`, but pointed at each scorecard's `/manage` page
 * (add/remove KPIs, edit capture setup). That page already gates on
 * `canManageSetup` per scorecard and shows a clear permission message when
 * it's false, so this landing doesn't need to duplicate that check - it just
 * needs to get the user to the right scorecard.
 */
export default async function SetupScorecardsPage() {
  const activeFy = await getActiveFinancialYear();
  const scorecards = await getScorecardsList(activeFy.selected?.id ?? null);

  if (scorecards.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold text-ink">Setup Scorecards</h1>
        <p className="text-sm text-ink2">No scorecards are in view for this financial year yet.</p>
      </div>
    );
  }

  if (scorecards.length === 1) {
    redirect(`/scorecards/${scorecards[0].scorecardId}/manage`);
  }

  const sorted = [...scorecards].sort((a, b) => a.orgName.localeCompare(b.orgName));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Setup Scorecards</h1>
        <p className="mt-1 text-sm text-ink2">
          Choose a scorecard to add or remove KPIs and edit its capture setup.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => (
          <Link
            key={s.scorecardId}
            href={`/scorecards/${s.scorecardId}/manage`}
            className="rounded-xl border border-line bg-white p-4 transition hover:border-gold"
          >
            <div className="text-sm font-semibold text-ink">{s.orgName}</div>
            <div className="mt-1 text-xs text-ink2">{s.kpiCount} KPIs</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
