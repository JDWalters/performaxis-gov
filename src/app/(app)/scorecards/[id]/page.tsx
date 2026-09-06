import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getScorecardDetail } from "@/lib/data/scorecards";
import { canPreviewNewFeatures } from "@/lib/feature-preview";
import type { Period } from "@/lib/data/sdbip-status";
import { KpiListWithSearch } from "./KpiListWithSearch";
import { DownloadOfflineFormButton } from "./DownloadOfflineFormButton";

const QUARTER_WINDOW: Record<number, string> = {
  1: "Jul–Sep",
  2: "Oct–Dec",
  3: "Jan–Mar",
  4: "Apr–Jun",
};

/** Parses the ?q= param into a Period - a plain quarter (capturable), or "mid"/"annual" (computed view-only checkpoints, see KpiListWithSearch). */
function parsePeriod(q: string | undefined): Period {
  if (q === "mid" || q === "annual") return q;
  const n = Math.min(4, Math.max(1, Number(q) || 4));
  return n as 1 | 2 | 3 | 4;
}

export default async function ScorecardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const period = parsePeriod(q);
  const isQuarter = typeof period === "number";
  // Mid-year/Annual aren't real capture periods with their own targets - they're
  // computed snapshots as-of Q2/Q4 (see statusForPeriod() in sdbip-status.ts), so
  // the underlying data fetch always anchors on a real quarter; KpiListWithSearch
  // decides whether to show that quarter's capture form or a computed view.
  const quarter = isQuarter ? period : period === "mid" ? 2 : 4;

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const showOfflineCapture = canPreviewNewFeatures(user?.email);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/scorecards" className="text-xs font-semibold text-ink2 hover:underline">
            ← All scorecards
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-ink">{detail.orgName}</h1>
        </div>
        {showOfflineCapture && (detail.canCapture || detail.canManageSetup) && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Offline capture/import and the per-quarter report export are
               tied to one real quarter's captured data - Mid-year/Annual are
               computed snapshots, not their own capture period, so these
               only make sense while a plain quarter tab is selected. */}
            {isQuarter && detail.canCapture && (
              <>
                <DownloadOfflineFormButton scorecardId={detail.scorecardId} orgName={detail.orgName} quarter={quarter} />
                <Link
                  href={`/scorecards/${id}/import?q=${quarter}`}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-ink"
                >
                  Import offline results
                </Link>
              </>
            )}
            {detail.canManageSetup && (
              <Link
                href={`/scorecards/${id}/manage?q=${quarter}`}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-ink"
              >
                Scorecard Setup
              </Link>
            )}
            <a
              href={`/scorecards/${id}/export/register`}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-ink"
            >
              Export register CSV
            </a>
            {isQuarter && (
              <a
                href={`/scorecards/${id}/export/report?q=${quarter}`}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-ink"
              >
                Export Q{quarter} report CSV
              </a>
            )}
          </div>
        )}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((qq) => (
            <Link
              key={qq}
              href={`/scorecards/${id}?q=${qq}`}
              prefetch={false}
              className={`relative rounded-md px-3 py-1.5 text-xs font-bold ${
                period === qq ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
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
          {(["mid", "annual"] as const).map((p) => (
            <Link
              key={p}
              href={`/scorecards/${id}?q=${p}`}
              prefetch={false}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                period === p ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              {p === "mid" ? "Mid-year" : "Annual"}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink2">
        {isQuarter ? (
          <>
            Capture the evidence figures for Q{quarter} ({QUARTER_WINDOW[quarter]}) · {detail.orgName}. Where a
            result does not meet the target, the <strong className="font-semibold text-ink">Performance Comment</strong> and{" "}
            <strong className="font-semibold text-ink">Corrective Action</strong> are compulsory before saving.
          </>
        ) : (
          <>
            {period === "mid" ? "Mid-year" : "Annual"} view for {detail.orgName} - each KPI&apos;s status computed
            as of {period === "mid" ? "Q2" : "Q4"}, applying its accumulation rule (standard, cumulative, or
            carry-over). This is a computed snapshot, not a separate capture period - results are still entered per
            quarter.
          </>
        )}
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
          period={period}
          scorecardId={detail.scorecardId}
        />
      )}
    </div>
  );
}
