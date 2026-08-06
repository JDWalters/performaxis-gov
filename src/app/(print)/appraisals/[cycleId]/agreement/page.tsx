import { notFound } from "next/navigation";
import { getAgreementData } from "@/lib/data/agreement";
import { AutoPrint } from "./AutoPrint";
import { PrintButton } from "./PrintButton";

const QUARTER_WINDOWS = [
  { label: "Jul – Sep" },
  { label: "Oct – Dec" },
  { label: "Jan – Mar" },
  { label: "Apr – Jun" },
];

function quarterWindow(startYear: number | null, q: number): string {
  if (!startYear) return "";
  const label = QUARTER_WINDOWS[q - 1].label;
  const year = q <= 2 ? startYear : startYear + 1;
  return `${label} ${year}`;
}

const REPORT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 11mm; }
}
* { box-sizing: border-box; }
body { margin: 0; }
.agdoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10.5pt; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tbody { display: table-row-group; }
table { page-break-inside: auto; border-collapse: collapse; }
tr, th, td { page-break-inside: avoid; }

.pgwrap { width: 100%; table-layout: fixed; border-collapse: collapse; border: 0; margin: 0; }
.pgwrap > tbody > tr > td.pgbcell, .pgwrap > tfoot > tr > td.pgfcell { padding: 0; border: 0; background: none; }
.pgbcell { vertical-align: top; padding-bottom: 8mm; }
.pgfcell { position: relative; height: 17mm; vertical-align: bottom; }
.pgfoot { height: 17mm; display: flex; align-items: center; justify-content: space-between; padding: 0 1mm 3mm 0; font-size: 8pt; color: #6b7680; border-top: 0.5pt solid #d8e0dd; }
.pgwm { position: absolute; left: 0; right: 0; bottom: 17mm; height: 150mm; z-index: -1; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.pgwm img { width: 105mm; max-width: 52%; height: auto; opacity: 0.07; }

.phead { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1.5pt solid #a97f2a; padding-bottom: 6px; margin-bottom: 14px; }
.ptitle { font-size: 16pt; font-weight: 800; color: #17313a; }
.psub { font-size: 9.5pt; color: #3c5560; margin-top: 2px; }
.pxmark { font-size: 9pt; font-weight: 700; color: #17313a; text-align: right; }
.pxmark span { color: #a97f2a; }

table.pt { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9pt; }
table.pt th { background: #eef1f1; color: #17313a; font-weight: 700; text-align: left; padding: 5px 6px; border: 0.5pt solid #d8e0dd; font-size: 8.5pt; }
table.pt td { padding: 5px 6px; border: 0.5pt solid #d8e0dd; vertical-align: top; }
table.pt tr:nth-child(even) td { background: #fbfbfb; }

.agtitle { font-size: 13pt; font-weight: 800; margin: 18px 0 6px; color: #17313a; }
.agparties td { padding: 4px 8px 4px 0; font-size: 9.5pt; }
.agparties td.k { font-weight: 700; color: #3c5560; width: 140px; }

.legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 4px; font-size: 8.5pt; }
.legend span.chip { border: 0.5pt solid #d8e0dd; border-radius: 999px; padding: 2px 8px; }

.psign { display: flex; gap: 24px; margin-top: 20px; }
.sigcol { flex: 1; }
.sigline { border-top: 0.75pt solid #17313a; margin-top: 26px; padding-top: 3px; font-size: 8.5pt; color: #3c5560; }
.sigrole { font-weight: 700; color: #17313a; }

.pbreak { page-break-before: always; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

export default async function AgreementPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const data = await getAgreementData(cycleId);
  if (!data) notFound();

  const { kpaWeight, competencyWeight, ratingScale, bonusBands } = data.policy;

  return (
    <div className="agdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />

      <div className="printbar">
        <PrintButton />
      </div>

      <table className="pgwrap">
        <tbody>
          <tr>
            <td className="pgbcell">
              <div className="phead">
                <div>
                  <div className="ptitle">{data.municipalityName}</div>
                  <div className="psub">
                    Performance Agreement &amp; Annexures · Financial year {data.fyLabel}
                  </div>
                  <div className="psub">Generated {new Date(data.generatedAt).toLocaleDateString("en-ZA")}</div>
                </div>
                <div className="pxmark">
                  Perform<span>Axis</span>
                </div>
              </div>

              <div className="agtitle">{data.agreementTitle}</div>
              <table className="agparties">
                <tbody>
                  <tr>
                    <td className="k">Employer</td>
                    <td>
                      {data.municipalityName}
                      {data.employerName ? ` — represented by ${data.employerTitle} ${data.employerName}` : ` — represented by the ${data.employerTitle}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="k">Employee</td>
                    <td>{data.employee.name}</td>
                  </tr>
                  <tr>
                    <td className="k">Position</td>
                    <td>{data.employee.position ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="k">Department</td>
                    <td>{data.employee.orgName}</td>
                  </tr>
                  <tr>
                    <td className="k">Employee no.</td>
                    <td>{data.employee.empno ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="k">Contract</td>
                    <td>{data.employee.contract ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="k">Financial year</td>
                    <td>{data.fyLabel}</td>
                  </tr>
                  <tr>
                    <td className="k">Applicable agreement</td>
                    <td>{data.agreementSection} — {data.employee.role === "MM" ? "Municipal Manager" : "Manager accountable to the MM"}</td>
                  </tr>
                  <tr>
                    <td className="k">Weighting</td>
                    <td>
                      KPA Component {kpaWeight}% · Competencies {competencyWeight}% · Total agreed KPI
                      weight {data.totalWeight.toFixed(0)}%
                      {Math.round(data.totalWeight) !== 100 && (
                        <span style={{ color: "#b3362b", fontWeight: 700 }}> (does not sum to 100 - review weights)</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="agtitle">Annexure A: Performance Plan</div>
              <table className="pt">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>KPA</th>
                    <th>KPI / Output</th>
                    <th>Unit of measure</th>
                    <th>Baseline</th>
                    <th>Annual target</th>
                    <th>Q1 ({quarterWindow(data.fyStartYear, 1)})</th>
                    <th>Q2 ({quarterWindow(data.fyStartYear, 2)})</th>
                    <th>Q3 ({quarterWindow(data.fyStartYear, 3)})</th>
                    <th>Q4 ({quarterWindow(data.fyStartYear, 4)})</th>
                    <th>Weight</th>
                    <th>Portfolio of evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kpis.map((k, i) => (
                    <tr key={`${k.name}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{k.kpa ?? "—"}</td>
                      <td>{k.name}</td>
                      <td>{k.unitOfMeasure ?? "—"}</td>
                      <td>{k.baseline ?? "—"}</td>
                      <td>{k.annualTarget ?? "—"}</td>
                      <td>{k.quarterlyTargets[0] ?? "—"}</td>
                      <td>{k.quarterlyTargets[1] ?? "—"}</td>
                      <td>{k.quarterlyTargets[2] ?? "—"}</td>
                      <td>{k.quarterlyTargets[3] ?? "—"}</td>
                      <td>{k.weight ? `${k.weight}%` : "—"}</td>
                      <td>{k.poe ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pbreak" />

              <div className="agtitle">Annexure B: Competency Assessment</div>
              <table className="pt">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Competency</th>
                    <th>Group</th>
                    <th>Driving competencies</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competencies.map((c, i) => (
                    <tr key={`${c.name}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{c.name}</td>
                      <td>{c.groupName ?? "—"}</td>
                      <td>{c.drivingText || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ fontSize: "9pt", fontWeight: 700, marginTop: "10px" }}>Rating scale</div>
              <div className="legend">
                {[...ratingScale]
                  .sort((a, b) => b.r - a.r)
                  .map((s) => (
                    <span className="chip" key={s.r}>
                      {s.r} — {s.term}
                    </span>
                  ))}
              </div>

              <div style={{ fontSize: "9pt", fontWeight: 700, marginTop: "10px" }}>
                Performance bonus eligibility (% of standard)
              </div>
              <div className="legend">
                {bonusBands.map((b) => (
                  <span className="chip" key={b.pay}>
                    {b.from}
                    {b.to >= 9999 ? "%+" : `–${b.to}%`} → {b.pay}
                  </span>
                ))}
              </div>

              <div className="agtitle">Review schedule</div>
              <table className="pt">
                <thead>
                  <tr>
                    <th>Quarter</th>
                    <th>Review period</th>
                    <th>Review type</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((q) => (
                    <tr key={q}>
                      <td>Q{q}</td>
                      <td>{quarterWindow(data.fyStartYear, q)}</td>
                      <td>{q === 2 || q === 4 ? "Formal assessment" : "Informal assessment"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="psign">
                <div className="sigcol">
                  <div className="sigline">
                    <div className="sigrole">Employee</div>
                    {data.employee.name} · Date: ______________________
                  </div>
                </div>
                <div className="sigcol">
                  <div className="sigline">
                    <div className="sigrole">{data.employerTitle} (Employer)</div>
                    Name: {data.employerName || "______________________"} · Date: ______________________
                  </div>
                </div>
                <div className="sigcol">
                  <div className="sigline">
                    <div className="sigrole">Witness</div>
                    Name: ______________________ · Date: ______________________
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="pgfcell">
              <div className="pgwm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/compass-rose-watermark.webp" alt="" />
              </div>
              <div className="pgfoot">
                <span>
                  {data.municipalityName} · Performance Agreement · {data.fyLabel}
                </span>
                <span>PerformAxis by Friday Management Solutions</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
