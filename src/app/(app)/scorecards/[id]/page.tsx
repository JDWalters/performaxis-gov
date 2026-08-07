import Link from "next/link";
import { notFound } from "next/navigation";
import { getScorecardDetail } from "@/lib/data/scorecards";
import { KpiListWithSearch } from "./KpiListWithSearch";
import { PerformAxisBrandMark } from "@/components/PerformAxisBrandMark";

const QUARTER_WINDOW: Record<number, string> = {
  1: "Jul–Sep",
  2: "Oct–Dec",
  3: "Jan–Mar",
  4: "Apr–Jun",
};

export default async function ScorecardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/scorecards" className="text-xs font-semibold text-ink2 hover:underline">
            ← All scorecards
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-ink">{detail.orgName}</h1>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((qq) => (
            <Link
              key={qq}
              href={`/scorecards/${id}?q=${qq}`}
              prefetch={false}
              className={`relative rounded-md px-3 py-1.5 text-xs font-bold ${
                qq === quarter
                  ? "bg-ink text-white"
                  : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              Q{qq}
              {detail.quartersNeedingReview.includes(qq) && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold"
                  title="Has items needing review"
                />
              )}
            </Link>
          ))}
        </div>
      </div>
      <div className="-mt-4 flex justify-end">
        <PerformAxisBrandMark />
      </div>

      <p className="text-sm text-ink2">
        Capture the evidence figures for Q{quarter} ({QUARTER_WINDOW[quarter]}) · {detail.orgName}. Where a
        result does not meet the target, the <strong className="font-semibold text-ink">Performance Comment</strong> and{" "}
        <strong className="font-semibold text-ink">Corrective Action</strong> are compulsory before saving.
      </p>

      {!detail.canCapture && (
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You have view-only access to this scorecard.
        </p>
      )}

      {detail.kpis.length === 0 ? (
        <p className="text-sm text-ink2">No KPIs on this scorecard yet.</p>
      ) : (
        <KpiListWithSearch
          kpis={detail.kpis}
          canCapture={detail.canCapture}
          quarter={quarter}
          scorecardId={detail.scorecardId}
        />
      )}
    </div>
  );
}
