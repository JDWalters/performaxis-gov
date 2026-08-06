import { notFound } from "next/navigation";
import { getAnnualSummary } from "@/lib/data/appraisals";
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
.andoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10.5pt; }
.phead { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1.5pt solid #a97f2a; padding-bottom: 6px; margin-bottom: 14px; }
.ptitle { font-size: 16pt; font-weight: 800; color: #17313a; }
.psub { font-size: 9.5pt; color: #3c5560; margin-top: 2px; }
.pxmark { font-size: 9pt; font-weight: 700; color: #17313a; text-align: right; }
.pxmark span { color: #a97f2a; }
.srow { display: flex; gap: 14px; margin: 10px 0 16px; }
.scard { flex: 1; border: 0.75pt solid #d8e0dd; border-radius: 6px; padding: 10px 14px; }
.scard.fin { border-color: #a97f2a; background: #fdf6ea; }
.bigsub { font-size: 8.5pt; color: #3c5560; font-weight: 700; text-transform: uppercase; }
.big { font-size: 20pt; font-weight: 800; margin: 2px 0; }
.psec { font-size: 11pt; font-weight: 800; margin: 16px 0 6px; color: #17313a; }
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
.pbox { background: #fbfbfb; border: 0.5pt solid #d8e0dd; border-radius: 6px; padding: 8px 12px; font-size: 9pt; margin: 8px 0 4px; }
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

export default async function AnnualReportPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const data = await getAnnualSummary(cycleId);
  if (!data) notFound();

  return (
    <div className="andoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />
      <div className="printbar">
        <PrintButton />
      </div>

      <div className="phead">
        <div>
          <div className="ptitle">Annual Performance Assessment Summary</div>
          <div className="psub">
            {data.employeeName} · {data.position ?? "—"} · {data.orgName} · {data.fyLabel}
          </div>
          <div className="psub">Generated {new Date().toLocaleDateString("en-ZA")}</div>
        </div>
        <div className="pxmark">
          Perform<span>Axis</span>
        </div>
      </div>

      <div className="srow">
        <div className="scard">
          <div className="bigsub">Average of assessed quarters</div>
          <div className="big">{fmt2(data.averageScore)}</div>
          <div className="bigsub">out of 5</div>
        </div>
        <div className="scard fin">
          <div className="bigsub">Year-end assessment</div>
          <div className="big">{fmt2(data.yearEndScore)}</div>
          <div className="bigsub">
            {data.yearEndBand && (
              <span className={`score ${BAND_CSS_CLASS[data.yearEndBand.tagClass] ?? ""}`}>{data.yearEndBand.label}</span>
            )}
          </div>
        </div>
      </div>

      {data.bonus && (
        <div className="pbox">
          <b>Bonus consideration:</b> {data.bonus.range} of the fully effective standard.
        </div>
      )}

      <div className="psec">Quarterly progression</div>
      <table className="pt">
        <thead>
          <tr>
            <th>Quarter</th>
            <th className="c">KPA score</th>
            <th className="c">Competency score</th>
            <th className="c">Weighted score</th>
            <th>Assessment band</th>
          </tr>
        </thead>
        <tbody>
          {data.quarters.map((q) => (
            <tr key={q.quarter}>
              <td>
                <b>Q{q.quarter}</b>
              </td>
              <td className="c">{fmt2(q.kpaScore)}</td>
              <td className="c">{fmt2(q.competencyScore)}</td>
              <td className="c">
                <b>{fmt2(q.overallScore)}</b>
              </td>
              <td>
                {q.band && <span className={`score ${BAND_CSS_CLASS[q.band.tagClass] ?? ""}`}>{q.band.label}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="psec">Year-end performance by indicator</div>
      <table className="pt">
        <thead>
          <tr>
            <th className="c">#</th>
            <th className="c">KPA</th>
            <th>Indicator</th>
            <th className="c">Weight</th>
          </tr>
        </thead>
        <tbody>
          {data.kpis.map((k, i) => (
            <tr key={k.id}>
              <td className="c">{i + 1}</td>
              <td className="c">{k.kpa ?? "—"}</td>
              <td>{k.name}</td>
              <td className="c">{k.weight ?? "—"}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="psign">
        <div className="sigcol">
          <div className="sigline">{data.employeeName}<br />Employee</div>
        </div>
        <div className="sigcol">
          <div className="sigline">Employer</div>
        </div>
        <div className="sigcol">
          <div className="sigline">Date</div>
        </div>
      </div>
    </div>
  );
}
