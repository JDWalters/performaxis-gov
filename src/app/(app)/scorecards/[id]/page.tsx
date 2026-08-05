import Link from "next/link";
import { notFound } from "next/navigation";
import { getScorecardDetail, friendlyActual } from "@/lib/data/scorecards";
import { KpiCaptureCard } from "./KpiCaptureCard";

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
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                qq === quarter
                  ? "bg-ink text-white"
                  : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              Q{qq}
            </Link>
          ))}
        </div>
      </div>

      {!detail.canCapture && (
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You have view-only access to this scorecard.
        </p>
      )}

      {detail.kpis.length === 0 ? (
        <p className="text-sm text-ink2">No KPIs on this scorecard yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {detail.kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {kpi.refCode && (
                      <span className="stag stag-pending text-[10px]">{kpi.refCode}</span>
                    )}
                    {kpi.kpa && (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink2">
                        {kpi.kpa}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold text-ink">{kpi.name}</div>
                  {kpi.unitOfMeasure && (
                    <div className="mt-0.5 text-xs text-ink2">{kpi.unitOfMeasure}</div>
                  )}
                </div>
                <div className="flex-none text-xs text-ink2 sm:text-right">
                  <div className="font-bold uppercase tracking-wide">Q{quarter} target</div>
                  <div className="mt-0.5 font-mono text-sm text-ink">{kpi.target ?? "—"}</div>
                </div>
              </div>

              {detail.canCapture ? (
                <KpiCaptureCard kpi={kpi} quarter={quarter} scorecardId={detail.scorecardId} />
              ) : (
                <div className="text-sm text-ink">
                  {friendlyActual(kpi) ?? "No result captured yet."}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
