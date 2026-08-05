import { getPerformanceProgress } from "@/lib/data/performance-progress";
import { ProgressScorecardPicker } from "./ProgressScorecardPicker";
import { ProgressExplorer } from "./ProgressExplorer";

export default async function PerformanceProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ sc?: string }>;
}) {
  const { sc } = await searchParams;
  const data = await getPerformanceProgress(sc);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Performance Progress</h1>
        <p className="mt-1 text-sm text-ink2">
          Track each KPI&apos;s quarter-over-quarter trend - by KPI, by KPA, or by department.
        </p>
      </div>

      <ProgressScorecardPicker options={data.scorecards} selectedId={data.selectedScorecardId} />

      {data.kpis.length === 0 ? (
        <p className="text-sm text-ink2">No KPIs on this scorecard yet.</p>
      ) : (
        <ProgressExplorer data={data} />
      )}
    </div>
  );
}
