import Link from "next/link";
import { getScorecardsList } from "@/lib/data/scorecards";

export default async function ScorecardsListPage() {
  const scorecards = await getScorecardsList();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">SDBIP Scorecards</h1>
        <p className="mt-1 text-sm text-ink2">
          Pick a department to view or capture its quarterly KPI results.
        </p>
      </div>

      {scorecards.length === 0 ? (
        <p className="text-sm text-ink2">No scorecards in view yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scorecards.map((s) => (
            <Link
              key={s.scorecardId}
              href={`/scorecards/${s.scorecardId}`}
              className="rounded-xl border border-line bg-white p-5 transition hover:border-gold"
            >
              <div className="text-sm font-semibold text-ink">{s.orgName}</div>
              <div className="mt-1 text-xs text-ink2">{s.kpiCount} KPIs</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
