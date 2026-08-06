import { notFound } from "next/navigation";
import { getAppraisalDetail } from "@/lib/data/appraisals";
import { finalRating } from "@/lib/data/appraisal-scoring";
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
.asdoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10.5pt; }
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
.c { text-align: center; }
.pbox { background: #fbfbfb; border: 0.5pt solid #d8e0dd; border-radius: 6px; padding: 8px 12px; font-size: 9pt; margin: 8px 0 12px; }
.psign { display: flex; gap: 24px; margin-top: 20px; }
.sigcol { flex: 1; }
.sigline { border-top: 0.75pt solid #17313a; margin-top: 26px; padding-top: 3px; font-size: 8.5pt; color: #3c5560; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

export default async function AssessmentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { cycleId } = await params;
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;
  const data = await getAppraisalDetail(cycleId, quarter);
  if (!data) notFound();

  return (
    <div className="asdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />
      <div className="printbar">
        <PrintButton />
      </div>

      <div className="phead">
        <div>
          <div className="ptitle">Quarterly / Panel Assessment</div>
          <div className="psub">
            {data.employeeName} · {data.position ?? "—"} · {data.orgName}
          </div>
          <div className="psub">
            Q{quarter} · {data.fyLabel} · Generated {new Date().toLocaleDateString("en-ZA")}
          </div>
        </div>
        <div className="pxmark">
          Perform<span>Axis</span>
        </div>
      </div>

      <div className="srow">
        <div className="scard">
          <div className="bigsub">KPA Component ({data.assessment.kpa.weightPct}%)</div>
          <div className="big">{fmt2(data.assessment.kpa.score)}</div>
        </div>
        <div className="scard">
          <div className="bigsub">Competencies ({data.assessment.competencies.weightPct}%)</div>
          <div className="big">{fmt2(data.assessment.competencies.score)}</div>
        </div>
        <div className="scard fin">
          <div className="bigsub">Overall weighted score</div>
          <div className="big">{fmt2(data.assessment.overall.score)}</div>
          <div className="bigsub">{data.assessment.overall.band?.label ?? "Not yet rated"}</div>
        </div>
      </div>

      <div className="psec">Part A — Key Performance Areas</div>
      <table className="pt">
        <thead>
          <tr>
            <th>KPI</th>
            <th className="c">Weight</th>
            <th className="c">Self</th>
            <th className="c">Employer/MM</th>
            <th className="c">Panel</th>
            <th className="c">Final</th>
          </tr>
        </thead>
        <tbody>
          {data.kpis.map((k) => {
            const r = k.result;
            const final = finalRating(r?.selfRating ?? null, r?.mgrRating ?? null, r?.panelRating ?? null);
            return (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="c">{r?.na ? "N/A" : `${k.effectiveWeightPct.toFixed(1)}%`}</td>
                <td className="c">{r?.selfRating ?? "—"}</td>
                <td className="c">{r?.mgrRating ?? "—"}</td>
                <td className="c">{r?.panelRating ?? "—"}</td>
                <td className="c">
                  <b>{final ?? "—"}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="psec">Part B — Competencies</div>
      <table className="pt">
        <thead>
          <tr>
            <th>Competency</th>
            <th className="c">Self</th>
            <th className="c">Employer/MM</th>
            <th className="c">Panel</th>
            <th className="c">Final</th>
          </tr>
        </thead>
        <tbody>
          {data.competencies.map((c) => {
            const final = finalRating(c.selfRating, c.mgrRating, c.panelRating);
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="c">{c.selfRating ?? "—"}</td>
                <td className="c">{c.mgrRating ?? "—"}</td>
                <td className="c">{c.panelRating ?? "—"}</td>
                <td className="c">
                  <b>{final ?? "—"}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(data.meta.employerComments || data.meta.employeeComments) && (
        <>
          <div className="psec">Assessment record</div>
          {data.meta.assessmentType && (
            <div className="pbox">
              <b>Assessment type:</b> {data.meta.assessmentType}
              {data.meta.assessmentDate ? ` · ${new Date(data.meta.assessmentDate).toLocaleDateString("en-ZA")}` : ""}
              {data.meta.panelMembers ? ` · Panel: ${data.meta.panelMembers}` : ""}
            </div>
          )}
          {data.meta.employerComments && (
            <div className="pbox">
              <b>Employer / panel comments:</b> {data.meta.employerComments}
            </div>
          )}
          {data.meta.employeeComments && (
            <div className="pbox">
              <b>Employee comments:</b> {data.meta.employeeComments}
            </div>
          )}
        </>
      )}

      <div className="psign">
        <div className="sigcol">
          <div className="sigline">{data.meta.employeeSignature || data.employeeName}<br />Employee</div>
        </div>
        <div className="sigcol">
          <div className="sigline">{data.meta.chairSignature || "Chairperson"}<br />Chairperson</div>
        </div>
        <div className="sigcol">
          <div className="sigline">Date</div>
        </div>
      </div>
    </div>
  );
}
