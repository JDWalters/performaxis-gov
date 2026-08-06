import { getOrgSummary } from "@/lib/data/appraisals";
import { AutoPrint, PrintButton } from "@/app/(print)/_shared/PrintControls";

function fmt2(n: number | null): string {
  return n == null ? "—" : n.toFixed(2);
}

const REPORT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 11mm; }
}
* { box-sizing: border-box; }
body { margin: 0; }
.orgdoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10.5pt; }
.phead { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1.5pt solid #a97f2a; padding-bottom: 6px; margin-bottom: 14px; }
.ptitle { font-size: 16pt; font-weight: 800; color: #17313a; }
.psub { font-size: 9.5pt; color: #3c5560; margin-top: 2px; }
.pxmark { font-size: 9pt; font-weight: 700; color: #17313a; text-align: right; }
.pxmark span { color: #a97f2a; }
.pbox { background: #fbfbfb; border: 0.5pt solid #d8e0dd; border-radius: 6px; padding: 8px 12px; font-size: 9pt; margin: 8px 0 12px; }
table.pt { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 8.5pt; }
table.pt th { background: #eef1f1; color: #17313a; font-weight: 700; text-align: left; padding: 5px 6px; border: 0.5pt solid #d8e0dd; font-size: 8pt; }
table.pt td { padding: 5px 6px; border: 0.5pt solid #d8e0dd; vertical-align: top; }
table.pt tr:nth-child(even) td { background: #fbfbfb; }
.score { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 8pt; font-weight: 700; }
.score.blue { background: #e4edf7; color: #2a5fa5; }
.score.met { background: #e3f3e8; color: #2f7d4f; }
.score.okk { background: #fdf1e2; color: #a97f2a; }
.score.almost { background: #fdeee2; color: #b5641f; }
.score.missed { background: #fbe4e2; color: #b3362b; }
.psign { display: flex; gap: 24px; margin-top: 20px; }
.sigcol { flex: 1; }
.sigline { border-top: 0.75pt solid #17313a; margin-top: 26px; padding-top: 3px; font-size: 8.5pt; color: #3c5560; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

const BAND_CSS_CLASS: Record<string, string> = {
  "stag-blue": "blue",
  "stag-met": "met",
  "stag-okk": "okk",
  "stag-almost": "almost",
  "stag-missed": "missed",
};

export default async function OrgSummaryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;
  const data = await getOrgSummary(quarter);

  if (!data || data.rows.length === 0) {
    return (
      <div className="orgdoc" style={{ padding: "24px" }}>
        <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
        <p>No appraisal cycles are visible to you for this quarter yet.</p>
      </div>
    );
  }

  const scored = data.rows.filter((r) => r.quarters[0]?.overallScore != null);
  const avg = scored.length
    ? scored.reduce((sum, r) => sum + (r.quarters[0]?.overallScore ?? 0), 0) / scored.length
    : null;

  return (
    <div className="orgdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />
      <div className="printbar">
        <PrintButton />
      </div>

      <div className="phead">
        <div>
          <div className="ptitle">Organisational Performance Summary</div>
          <div className="psub">
            Q{quarter} · {data.fyLabel}
          </div>
          <div className="psub">Generated {new Date().toLocaleDateString("en-ZA")}</div>
        </div>
        <div className="pxmark">
          Perform<span>Axis</span>
        </div>
      </div>

      <div className="pbox">
        <b>Employees assessed:</b> {scored.length} of {data.rows.length} &nbsp;&nbsp;
        <b>Average weighted score:</b> {avg == null ? "—" : `${fmt2(avg)} / 5`}
      </div>

      <table className="pt">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Position</th>
            <th>Department</th>
            <th className="c">Indicators</th>
            <th className="c">KPA score</th>
            <th className="c">Competency</th>
            <th className="c">Weighted score</th>
            <th>Assessment band</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const o = r.quarters[0];
            return (
              <tr key={r.cycleId}>
                <td>
                  <b>{r.employeeName}</b>
                </td>
                <td>{r.position ?? "—"}</td>
                <td>{r.orgName}</td>
                <td className="c">{r.kpiCount}</td>
                <td className="c">{fmt2(o?.kpaScore ?? null)}</td>
                <td className="c">{fmt2(o?.competencyScore ?? null)}</td>
                <td className="c">
                  <b>{fmt2(o?.overallScore ?? null)}</b>
                </td>
                <td>
                  {o?.band && <span className={`score ${BAND_CSS_CLASS[o.band.tagClass] ?? ""}`}>{o.band.label}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="psign">
        <div className="sigcol">
          <div className="sigline">Municipal Manager</div>
        </div>
        <div className="sigcol">
          <div className="sigline">Chairperson: Performance Audit Committee</div>
        </div>
        <div className="sigcol">
          <div className="sigline">Date</div>
        </div>
      </div>
    </div>
  );
}
