import { getSdbipDashboard, getSdbipReportKpis } from "@/lib/data/sdbip-dashboard";
import { getActiveFinancialYear } from "@/lib/data/financial-years";
import { STATUS_META } from "@/lib/data/sdbip-status";
import type { Period, Status } from "@/lib/data/sdbip-status";
import { AutoPrint, PrintButton } from "@/app/(print)/_shared/PrintControls";

/**
 * The reference tool's printDlgHtml()/buildReport() - a formatted,
 * print-or-PDF-ready SDBIP report: masthead, status summary, optional
 * dashboard-summary breakdowns (by department, by KPA, attention-required),
 * optional detailed KPI table, an assessment-key legend and a signature
 * block. Reuses getSdbipDashboard() for the rollup (same data the live
 * dashboard shows) and the new getSdbipReportKpis() for the flat per-KPI
 * table, so the report can never disagree with the on-screen dashboard.
 *
 * Deliberately a fixed set of columns rather than the reference's
 * column-picker UI (plan/assess/all presets) - keeps this to one report
 * shape covering the common case (hand to Council / file for audit) instead
 * of a full customiser, which can be added later if the client asks for it.
 *
 * ?sc=<scorecardId|top> (default "top"), ?period=q1|q2|q3|q4|mid|annual
 * (default "annual"), ?fy=<financialYearId> (default: the signed-in user's
 * active year), ?dash=0 to hide the dashboard-summary section, ?table=0 to
 * hide the detailed KPI table.
 */

const PERIOD_KEYS: Record<string, Period> = {
  q1: 1,
  q2: 2,
  q3: 3,
  q4: 4,
  mid: "mid",
  annual: "annual",
};

function periodLabel(period: Period): string {
  if (period === "mid") return "Mid-year";
  if (period === "annual") return "Annual";
  return `Quarter ${period}`;
}

const REPORT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 11mm; }
}
* { box-sizing: border-box; }
body { margin: 0; }
.rdoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10pt; }
.phead { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1.5pt solid #a97f2a; padding-bottom: 6px; margin-bottom: 14px; }
.ptitle { font-size: 16pt; font-weight: 800; color: #17313a; }
.psub { font-size: 9.5pt; color: #3c5560; margin-top: 2px; }
.pxmark { font-size: 9pt; font-weight: 700; color: #17313a; text-align: right; }
.pxmark span { color: #a97f2a; }
.chiprow { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 16px; }
.chip { border-radius: 999px; padding: 5px 12px; font-size: 8.5pt; font-weight: 700; }
.chip.blue { background: #e4edf7; color: #2a5fa5; }
.chip.met { background: #e3f3e8; color: #2f7d4f; }
.chip.almost { background: #fdeee2; color: #b5641f; }
.chip.missed { background: #fbe4e2; color: #b3362b; }
.chip.pending { background: #eef1f1; color: #3c5560; }
.chip.total { background: #17313a; color: #fff; }
h2.sect { font-size: 11pt; font-weight: 800; color: #17313a; margin: 18px 0 8px; }
table.pt { width: 100%; border-collapse: collapse; margin: 4px 0 12px; font-size: 8.5pt; }
table.pt th { background: #eef1f1; color: #17313a; font-weight: 700; text-align: left; padding: 5px 6px; border: 0.5pt solid #d8e0dd; font-size: 8pt; }
table.pt td { padding: 5px 6px; border: 0.5pt solid #d8e0dd; vertical-align: top; }
table.pt tr:nth-child(even) td { background: #fbfbfb; }
.c { text-align: center; }
.stag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
.stag-blue { background: #e4edf7; color: #2a5fa5; }
.stag-met { background: #e3f3e8; color: #2f7d4f; }
.stag-almost { background: #fdeee2; color: #b5641f; }
.stag-missed { background: #fbe4e2; color: #b3362b; }
.stag-pending { background: #eef1f1; color: #3c5560; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 0 18px; font-size: 8pt; align-items: center; }
.pbreak { page-break-before: always; }
.psign { display: flex; gap: 24px; margin-top: 24px; }
.sigcol { flex: 1; }
.sigline { border-top: 0.75pt solid #17313a; margin-top: 26px; padding-top: 3px; font-size: 8.5pt; color: #3c5560; }
.pfoot { margin-top: 16px; font-size: 7.5pt; color: #8fa0a8; text-align: right; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

export default async function SdbipReportPage({
  searchParams,
}: {
  searchParams: Promise<{ sc?: string; period?: string; fy?: string; dash?: string; table?: string }>;
}) {
  const { sc, period: periodKey, fy, dash, table } = await searchParams;
  const period: Period = PERIOD_KEYS[periodKey ?? "annual"] ?? "annual";
  const showDash = dash !== "0";
  const showTable = table !== "0";

  const activeFy = await getActiveFinancialYear();
  const explicitYear = fy ? activeFy.years.find((y) => y.id === fy) : undefined;
  const fyId = explicitYear?.id ?? (fy ? fy : (activeFy.selected?.id ?? null));
  const fyLabel = explicitYear?.label ?? activeFy.selected?.label ?? "—";

  const [dashboard, kpis] = await Promise.all([
    getSdbipDashboard(sc, period, fyId),
    showTable ? getSdbipReportKpis(sc, period, fyId) : Promise.resolve([]),
  ]);

  const isTop = dashboard.selectedScorecardId === "top";
  const generated = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="rdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />
      <div className="printbar">
        <PrintButton />
      </div>

      <div className="phead">
        <div>
          <div className="ptitle">SDBIP Performance Report</div>
          <div className="psub">
            {dashboard.selectedLabel} · {periodLabel(period)} · FY {fyLabel}
          </div>
          <div className="psub">Generated {generated}</div>
        </div>
        <div className="pxmark">
          Perform<span>Axis</span>
        </div>
      </div>

      <div className="chiprow">
        <span className="chip total">{dashboard.kpiCount} indicators</span>
        <span className="chip total">{dashboard.pctAchieved == null ? "—" : `${dashboard.pctAchieved}%`} achieved</span>
        <span className="chip blue">{dashboard.tally.blue} well achieved</span>
        <span className="chip met">{dashboard.tally.met} achieved</span>
        <span className="chip almost">{dashboard.tally.almost} almost</span>
        <span className="chip missed">{dashboard.tally.missed} not achieved</span>
        <span className="chip pending">{dashboard.tally.pending} not yet reportable</span>
      </div>

      {showDash && (
        <>
          {isTop && dashboard.departments.length > 0 && (
            <>
              <h2 className="sect">Performance by department</h2>
              <table className="pt">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="c">Indicators</th>
                    <th className="c">Well achieved</th>
                    <th className="c">Achieved</th>
                    <th className="c">Almost</th>
                    <th className="c">Not achieved</th>
                    <th className="c">Not yet reportable</th>
                    <th className="c">% Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.departments.map((d) => (
                    <tr key={d.orgId}>
                      <td>
                        {d.orgCode ? `${d.orgCode} — ` : ""}
                        {d.orgName}
                      </td>
                      <td className="c">{d.kpiCount}</td>
                      <td className="c">{d.tally.blue}</td>
                      <td className="c">{d.tally.met}</td>
                      <td className="c">{d.tally.almost}</td>
                      <td className="c">{d.tally.missed}</td>
                      <td className="c">{d.tally.pending}</td>
                      <td className="c">
                        <b>{d.pctAchieved == null ? "—" : `${d.pctAchieved}%`}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2 className="sect">Performance by Key Performance Area</h2>
          <table className="pt">
            <thead>
              <tr>
                <th>KPA</th>
                <th className="c">Indicators</th>
                <th className="c">Well achieved</th>
                <th className="c">Achieved</th>
                <th className="c">Almost</th>
                <th className="c">Not achieved</th>
                <th className="c">Not yet reportable</th>
                <th className="c">% Achieved</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.kpas.map((k) => (
                <tr key={k.kpa}>
                  <td>{k.kpa}</td>
                  <td className="c">{k.kpiCount}</td>
                  <td className="c">{k.tally.blue}</td>
                  <td className="c">{k.tally.met}</td>
                  <td className="c">{k.tally.almost}</td>
                  <td className="c">{k.tally.missed}</td>
                  <td className="c">{k.tally.pending}</td>
                  <td className="c">
                    <b>{k.pctAchieved == null ? "—" : `${k.pctAchieved}%`}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="sect">
            Attention required <span style={{ fontWeight: 400 }}>({dashboard.attention.length} below target)</span>
          </h2>
          {dashboard.attention.length === 0 ? (
            <p className="psub">Nothing below target for this period.</p>
          ) : (
            <table className="pt">
              <thead>
                <tr>
                  <th>Ref</th>
                  {isTop && <th>Dept</th>}
                  <th>Key Performance Indicator</th>
                  <th>Target</th>
                  <th>Result</th>
                  <th>Assessment</th>
                  <th>Corrective action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.attention.map((a, i) => (
                  <tr key={i}>
                    <td>{a.refCode ?? "—"}</td>
                    {isTop && <td>{a.orgName}</td>}
                    <td>{a.name}</td>
                    <td>{a.target ?? "—"}</td>
                    <td>{a.result ?? "—"}</td>
                    <td>
                      <span className={`stag stag-${a.status}`}>{STATUS_META[a.status as Status].label}</span>
                    </td>
                    <td>
                      {a.correctiveCaptured ? (
                        <>
                          <b>Captured</b>
                          {a.correctiveNote && <div>{a.correctiveNote}</div>}
                        </>
                      ) : (
                        <b>Outstanding</b>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {showTable && kpis.length > 0 && (
        <>
          <div className={showDash ? "pbreak" : ""} />
          <h2 className="sect">Detailed KPI report</h2>
          <table className="pt">
            <thead>
              <tr>
                <th>Ref</th>
                {isTop && <th>Dept</th>}
                <th>Key Performance Indicator</th>
                <th>KPA</th>
                <th>Unit</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Assessment</th>
                <th>Corrective action</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.scorecardId + (k.refCode ?? k.name)}>
                  <td>{k.refCode ?? "—"}</td>
                  {isTop && <td>{k.orgName}</td>}
                  <td>{k.name}</td>
                  <td>{k.kpa ?? "—"}</td>
                  <td>{k.unit ?? "—"}</td>
                  <td>{k.target ?? "—"}</td>
                  <td>{k.actual ?? "—"}</td>
                  <td>
                    <span className={`stag stag-${k.status}`}>{STATUS_META[k.status].label}</span>
                  </td>
                  <td>{k.correctiveNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="legend">
        <b>Assessment key:</b>
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <span key={s} className={`stag stag-${s}`}>
            {STATUS_META[s].label}
          </span>
        ))}
      </div>

      <div className="psign">
        {!isTop ? (
          <>
            <div className="sigcol">
              <div className="sigline">Head of Department: {dashboard.selectedLabel.replace(" — Departmental SDBIP", "")}</div>
            </div>
            <div className="sigcol">
              <div className="sigline">Municipal Manager</div>
            </div>
          </>
        ) : (
          <>
            <div className="sigcol">
              <div className="sigline">Municipal Manager</div>
            </div>
            <div className="sigcol">
              <div className="sigline">Performance Management</div>
            </div>
          </>
        )}
        <div className="sigcol">
          <div className="sigline">Date</div>
        </div>
      </div>

      <div className="pfoot">PerformAxis · Generated {generated}</div>
    </div>
  );
}
