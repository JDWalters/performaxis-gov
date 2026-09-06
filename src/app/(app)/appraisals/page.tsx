import Link from "next/link";
import { getEpasDashboard } from "@/lib/data/epas-dashboard";
import { getActiveFinancialYear } from "@/lib/data/financial-years";
import { getActiveScope } from "@/lib/data/scope";
import { clearScope } from "@/app/(app)/scope-actions";
import { EpasStatusBar, EpasBigScore, EpasMiniCell, EpasKpaBar } from "./EpasDashboardCharts";

/**
 * The EPAS Dashboard - a direct port of the reference tool's pageDash(),
 * not a reuse of the SDBIP dashboard's per-KPI/per-department layout. The
 * reference has no employee picker on this screen at all - it always shows
 * every accessible employee, each scored as a whole (KPA component +
 * competency component weighted together), banded on a 6-tier scale. See
 * src/lib/data/epas-dashboard.ts for the scoring.
 */
export default async function EpasDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 1)) : 1;

  const [activeFy, scope] = await Promise.all([getActiveFinancialYear(), getActiveScope()]);
  const fyId = activeFy.selected?.id ?? null;

  const dashboard = await getEpasDashboard(quarter, fyId, scope?.orgIds ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">EPAS Dashboard</h1>
          <p className="mt-1 text-sm text-ink2">
            Section 57/56 performance assessments, live from captured ratings.
            {activeFy.selected && <span className="ml-1 font-semibold text-ink">FY {activeFy.selected.label}.</span>}
          </p>
        </div>
        <Link
          href="/appraisals/list"
          className="rounded-md border border-line bg-white px-4 py-2 text-xs font-bold text-ink2 hover:border-ink"
        >
          Browse all cycles
        </Link>
      </div>

      {scope && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gold/40 bg-gold-bg px-3 py-2 text-sm font-semibold text-ink">
          <span>
            Viewing scope: <span className="text-gold">{scope.org.name}</span> and everything under it
          </span>
          <form action={clearScope}>
            <input type="hidden" name="returnTo" value="/appraisals" />
            <button type="submit" className="ml-1 text-xs font-bold text-ink2 underline hover:text-ink">
              Clear
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4].map((qq) => (
            <Link
              key={qq}
              href={`/appraisals?q=${qq}`}
              prefetch={false}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                qq === quarter ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              Q{qq}
            </Link>
          ))}
        </div>
        <div className="text-xs font-semibold text-ink2">
          {dashboard.quarterLabel} · <b className="text-ink">{dashboard.reviewType}</b>
          {dashboard.reviewDueLabel !== "—" && <> · due {dashboard.reviewDueLabel}</>}
        </div>
      </div>

      {dashboard.employeeCount === 0 ? (
        <p className="text-sm text-ink2">No employees in view yet.</p>
      ) : (
        <>
          <div className="rounded-xl bg-ink p-5 text-white">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
              <EpasBigScore
                score={dashboard.avgScore}
                caption={
                  dashboard.avgScore == null
                    ? "No assessments captured yet"
                    : `${dashboard.avgBand?.label} · ${Math.round(dashboard.avgPercentOfStandard ?? 0)}% of the fully effective standard`
                }
                dark
              />
              <div className="min-w-[280px] flex-1">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">
                  Assessment status · {dashboard.reviewType}
                </div>
                <EpasStatusBar tally={dashboard.tally} dark />
              </div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/75">
              Weighting: KPAs {dashboard.kpaWeightPct}% · Competencies {dashboard.compWeightPct}%
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink2">
              Employees · {dashboard.quarterLabel} assessment
            </h2>
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2">Position</th>
                    <th className="px-4 py-2">Department</th>
                    <th className="px-4 py-2 text-center">KPIs</th>
                    <th className="px-4 py-2 text-center">Weight</th>
                    <th className="px-4 py-2 text-center">KPA score</th>
                    <th className="px-4 py-2 text-center">Competency</th>
                    <th className="px-4 py-2 text-center">Weighted score</th>
                    <th className="px-4 py-2 text-center">Result %</th>
                    <th className="px-4 py-2">Assessment band</th>
                    {[1, 2, 3, 4].map((qq) => (
                      <th key={qq} className="px-2 py-2 text-center">
                        Q{qq}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.employees.map((e) => (
                    <tr key={e.cycleId} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/appraisals/${e.cycleId}`} className="font-semibold text-ink hover:underline">
                          {e.employeeName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-ink2">{e.position ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-ink2">{e.role === "MM" ? "—" : e.orgName}</td>
                      <td className="px-4 py-2 text-center">{e.kpiCount}</td>
                      <td
                        className={`px-4 py-2 text-center font-mono text-xs ${e.weightOk ? "text-ink2" : "font-bold text-missed"}`}
                        title={e.weightOk ? undefined : "Weightings should total 100%"}
                      >
                        {e.weightPct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-ink">
                        {e.kpaScore == null ? "—" : e.kpaScore.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-xs text-ink">
                        {e.compScore == null ? "—" : e.compScore.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-sm font-bold text-ink">
                        {e.overallScore == null ? "—" : e.overallScore.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-sm font-bold text-ink">
                        {e.resultPct == null ? "—" : `${e.resultPct.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-2">
                        {e.band ? (
                          <span className={`stag ${e.band.tagClass}`}>{e.band.label}</span>
                        ) : (
                          <span className="stag stag-pending">Not assessed</span>
                        )}
                      </td>
                      {e.quarterScores.map((s, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          <EpasMiniCell score={s} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink2">
              Average score by Key Performance Area · {dashboard.quarterLabel}
            </h2>
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
              {dashboard.kpas.map((k) => (
                <div key={k.code} className="flex items-center gap-3">
                  <span className="w-64 flex-none text-xs font-semibold text-ink2">{k.name}</span>
                  <div className="flex-1">
                    <EpasKpaBar score={k.avgScore} />
                  </div>
                  <span className="w-12 flex-none text-right font-mono text-sm font-bold text-ink">
                    {k.avgScore == null ? "—" : k.avgScore.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
