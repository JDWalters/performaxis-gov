import Link from "next/link";
import { getSdbipDashboard } from "@/lib/data/sdbip-dashboard";
import { getScorecardsList } from "@/lib/data/scorecards";
import type { Period } from "@/lib/data/sdbip-status";
import { STATUS_META } from "@/lib/data/sdbip-status";
import { DonutChart, BigStat, StatusBar, QuarterTrend } from "./DashboardCharts";
import { ScorecardPicker } from "./ScorecardPicker";

const PERIOD_OPTIONS: { key: string; label: string; period: Period }[] = [
  { key: "q1", label: "Q1", period: 1 },
  { key: "q2", label: "Q2", period: 2 },
  { key: "q3", label: "Q3", period: 3 },
  { key: "q4", label: "Q4", period: 4 },
  { key: "mid", label: "Mid-year", period: "mid" },
  { key: "annual", label: "Annual", period: "annual" },
];

export default async function ScorecardsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sc?: string; period?: string }>;
}) {
  const { sc, period: periodKey } = await searchParams;
  const activeOption = PERIOD_OPTIONS.find((p) => p.key === periodKey) ?? PERIOD_OPTIONS[3];

  const [dashboard, scorecardList] = await Promise.all([
    getSdbipDashboard(sc, activeOption.period),
    getScorecardsList(),
  ]);

  const needsReviewByOrg = new Map(scorecardList.map((s) => [s.orgId, s.needsReviewCount]));
  const currentQuarter = typeof activeOption.period === "number" ? activeOption.period : null;
  const isTop = dashboard.selectedScorecardId === "top";
  const selectedScorecard = scorecardList.find((s) => s.scorecardId === dashboard.selectedScorecardId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">SDBIP Dashboard</h1>
          <p className="mt-1 text-sm text-ink2">Live service-delivery performance, rolled up from captured results.</p>
        </div>
        {!isTop && (
          <Link
            href={`/scorecards/${dashboard.selectedScorecardId}`}
            className="rounded-md bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/90"
          >
            Capture this scorecard →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ScorecardPicker
          options={dashboard.scorecards}
          selectedId={dashboard.selectedScorecardId}
          periodKey={activeOption.key}
        />

        <div className="flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <Link
              key={p.key}
              href={`/scorecards?sc=${dashboard.selectedScorecardId}&period=${p.key}`}
              prefetch={false}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                p.key === activeOption.key
                  ? "bg-ink text-white"
                  : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {dashboard.kpiCount === 0 ? (
        <p className="text-sm text-ink2">No KPIs on this scorecard yet.</p>
      ) : (
        <>
          <div className="rounded-xl bg-ink p-5 text-white">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gold">
              {dashboard.selectedLabel} ·{" "}
              {activeOption.period === "mid"
                ? "Mid-year"
                : activeOption.period === "annual"
                  ? "Annual"
                  : `Q${activeOption.period}`}
            </div>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
              <div className="flex items-center gap-4">
                <DonutChart tally={dashboard.tally} />
                <BigStat pctAchieved={dashboard.pctAchieved} caption="of reportable targets achieved" dark />
              </div>
              <div className="min-w-[260px] flex-1">
                <StatusBar tally={dashboard.tally} dark />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">
                  Quarter-by-quarter
                </div>
                <QuarterTrend trend={dashboard.quarterTrend} currentQuarter={currentQuarter} dark />
              </div>
            </div>
          </div>

          {isTop && dashboard.departments.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink2">
                Performance by department
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.departments.map((d) => (
                  <Link
                    key={d.orgId}
                    href={`/scorecards?sc=${scorecardList.find((s) => s.orgId === d.orgId)?.scorecardId ?? "top"}&period=${activeOption.key}`}
                    className="rounded-xl border border-line bg-white p-4 transition hover:border-gold"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {d.orgCode && (
                          <span className="flex-none rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                            {d.orgCode}
                          </span>
                        )}
                        <div className="text-sm font-semibold text-ink">{d.orgName}</div>
                      </div>
                      {(needsReviewByOrg.get(d.orgId) ?? 0) > 0 && (
                        <span className="flex-none rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                          {needsReviewByOrg.get(d.orgId)} need review
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink2">{d.kpiCount} KPIs</div>
                    <div className="mt-2 text-2xl font-extrabold text-ink">
                      {d.pctAchieved ?? "—"}
                      {d.pctAchieved != null && "%"}
                    </div>
                    <div className="mt-2">
                      <StatusBar tally={d.tally} compact />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1">
                      {d.quarterPct.map((pct, i) => (
                        <div
                          key={i}
                          className={`rounded px-1 py-1 text-center text-[11px] font-bold ${
                            i + 1 === currentQuarter ? "bg-gold/15 text-gold" : "bg-paper text-ink2"
                          }`}
                        >
                          <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">Q{i + 1}</div>
                          <div>{pct == null ? "—" : `${pct}%`}</div>
                        </div>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!isTop && selectedScorecard && (
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="text-sm font-semibold text-ink">{selectedScorecard.orgName}</div>
              <div className="text-xs text-ink2">{selectedScorecard.kpiCount} KPIs</div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink2">
              Performance by Key Performance Area
            </h2>
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
              {dashboard.kpas.map((k) => (
                <div key={k.kpa} className="flex items-center gap-3">
                  <span className="w-16 flex-none text-xs font-bold text-ink2">{k.kpa}</span>
                  <div className="flex-1">
                    <StatusBar tally={k.tally} compact />
                  </div>
                  <span className="w-14 flex-none text-right text-sm font-bold text-ink">
                    {k.pctAchieved == null ? "—" : `${k.pctAchieved}%`}
                  </span>
                  <span className="w-16 flex-none text-right text-xs text-ink2">{k.kpiCount} KPIs</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink2">
              Attention required
              <span className="ml-2 font-normal normal-case text-ink2">
                {dashboard.attention.length} KPI{dashboard.attention.length === 1 ? "" : "s"} below target
              </span>
            </h2>
            {dashboard.attention.length === 0 ? (
              <p className="text-sm text-ink2">Nothing below target for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                      <th className="px-4 py-2">Ref</th>
                      {isTop && <th className="px-4 py-2">Dept</th>}
                      <th className="px-4 py-2">Key Performance Indicator</th>
                      <th className="px-4 py-2">Target</th>
                      <th className="px-4 py-2">Result</th>
                      <th className="px-4 py-2">Assessment</th>
                      <th className="px-4 py-2">Corrective action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.attention.map((a, i) => (
                      <tr key={i} className="border-b border-line last:border-0 align-top">
                        <td className="px-4 py-2 text-xs text-ink2">{a.refCode ?? "—"}</td>
                        {isTop && <td className="px-4 py-2 text-xs text-ink2">{a.orgName}</td>}
                        <td className="px-4 py-2 text-ink">{a.name}</td>
                        <td className="px-4 py-2 font-mono text-xs text-ink">{a.target ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-ink">{a.result ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`stag ${STATUS_META[a.status].tagClass}`}>
                            {STATUS_META[a.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {a.correctiveCaptured ? (
                            <>
                              <span className="font-bold text-met">✓ Captured</span>
                              {a.correctiveNote && <div className="mt-0.5 text-ink2">{a.correctiveNote}</div>}
                            </>
                          ) : (
                            <span className="font-bold text-missed">✗ Outstanding</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
