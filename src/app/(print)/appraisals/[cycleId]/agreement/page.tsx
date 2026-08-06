import { notFound } from "next/navigation";
import { getAgreementData } from "@/lib/data/agreement";
import { KPI_RATING_DESCRIPTIONS, COMPETENCY_RATING_DESCRIPTIONS } from "@/lib/data/appraisal-scoring";
import { AutoPrint } from "./AutoPrint";
import { PrintButton } from "./PrintButton";

const QUARTER_WINDOWS = [
  { label: "July – September" },
  { label: "October – December" },
  { label: "January – March" },
  { label: "April – June" },
];

function quarterWindowParts(startYear: number | null, q: number): { label: string; year: string } {
  if (!startYear) return { label: "", year: "" };
  const label = QUARTER_WINDOWS[q - 1].label;
  const year = q <= 2 ? startYear : startYear + 1;
  return { label, year: String(year) };
}

function quarterWindow(startYear: number | null, q: number): string {
  const { label, year } = quarterWindowParts(startYear, q);
  return label ? `${label} ${year}` : "";
}

// Fixed 2-5 competency-rating terminology - the reference's COMP_SCALE. Not
// policy-configurable (unlike the KPI rating scale) because the Regulations
// define these achievement levels by name, not by municipal discretion.
const COMPETENCY_SCALE_TERMS: Record<number, string> = { 5: "Superior", 4: "Advanced", 3: "Competent", 2: "Basic" };

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

.c { text-align: center; }
table.pt { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9pt; }
table.pt th { background: #f0dfae; color: #17313a; font-weight: 800; text-align: left; padding: 6px 6px; border: 0.5pt solid #d8b25a; font-size: 9.5pt; white-space: nowrap; text-transform: uppercase; }
table.pt td { padding: 5px 6px; border: 0.5pt solid #d8e0dd; vertical-align: top; }
table.pt tr:nth-child(even) td { background: #fbfbfb; }
table.pt tr.pt-total td { background: #fdf6ea; font-weight: 700; }
table.pt tr.pt-groupHead td { background: #f0dfae; color: #17313a; font-weight: 800; border: 0.5pt solid #d8b25a; font-size: 9.5pt; white-space: nowrap; text-transform: uppercase; }

/* Matches the reference tool's .agparties/.agtitle/.agsub/.agsub2/.agpt/.agk
   exactly - a bordered block (agreement title, municipality name in gold,
   FY + period) that sits above a table with a thin bottom border per row
   and bold/uppercase/gray "THE EMPLOYER"-style labels, not the plain
   unbordered list this used to be. */
.agparties { border-bottom: 1.5pt solid #a97f2a; padding-bottom: 8pt; margin-bottom: 10pt; }
.agtitle { font-size: 14pt; font-weight: 800; color: #17313a; }
.agsub { font-size: 12pt; font-weight: 700; color: #a97f2a; margin-top: 3pt; }
.agsub2 { font-size: 9pt; color: #555; margin-top: 2pt; }
table.agpt { width: 100%; border-collapse: collapse; margin-top: 8pt; font-size: 9pt; }
.agpt td { padding: 4px 8px 4px 0; border-bottom: 0.5pt solid #ccc; vertical-align: top; }
.agk { width: 150pt; font-weight: 800; font-size: 8pt; text-transform: uppercase; color: #444; }

/* The reference tool's .mf - every value pulled from live data (names,
   dates, places) rather than fixed boilerplate legal text gets this
   treatment so a reader can see at a glance what was actually filled in. */
.mf { font-weight: 700; border-bottom: 1pt solid #a97f2a; }

.pact { font-size: 10.5pt; font-weight: 800; margin: 16px 0 8px; text-transform: uppercase; }
.clh { display: flex; gap: 10px; margin: 14px 0 7px; }
.clh .clno { flex: 0 0 26px; font-weight: 800; }
.clh .cltx { flex: 1; font-weight: 800; text-transform: uppercase; font-size: 10pt; border-bottom: 1pt solid #a97f2a; padding-bottom: 3pt; }
.cl { display: flex; gap: 10px; margin: 0 0 6px; }
.cl .clno { flex: 0 0 26px; font-weight: 700; color: #3c5560; }
.cl .cltx { flex: 1; }
.cl .cltx ul { margin: 4px 0 4px 16px; padding: 0; }

.legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 4px; font-size: 8.5pt; }
.legend span.chip { border: 0.5pt solid #d8e0dd; border-radius: 999px; padding: 2px 8px; }

.psign { display: flex; gap: 24px; margin-top: 12px; }
.sigcol { flex: 1; }
.sigline { border-top: 0.75pt solid #17313a; margin-top: 26px; padding-top: 3px; font-size: 8.5pt; color: #3c5560; }
.sigrole { font-weight: 700; color: #17313a; }
.sigblock { margin: 10px 0 4px; font-size: 9.5pt; }

.pbreak { page-break-before: always; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

/** One numbered sub-clause, e.g. "1.1  The Employer has entered into…". */
function Cl({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="cl">
      <span className="clno">{n}</span>
      <div className="cltx">{children}</div>
    </div>
  );
}

/** A top-level numbered clause heading, e.g. "1  INTRODUCTION". */
function ClHead({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="clh">
      <span className="clno">{n}</span>
      <div className="cltx">{children}</div>
    </div>
  );
}

/** Marks a value as filled in from live data (a name, date, place, weight…)
 * rather than fixed legal boilerplate - the reference tool's .mf treatment. */
function Mf({ children }: { children: React.ReactNode }) {
  return <span className="mf">{children}</span>;
}

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { cycleId } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === "1";
  const data = await getAgreementData(cycleId);
  if (!data) notFound();

  const { ratingScale, bonusBands } = data.policy;
  const { signPlaceDefault, signDayDefault, signMonthDefault } = data.policy;
  const isMM = data.employee.role === "MM";
  const sectionNum = isMM ? "57" : "56";
  const y1 = data.fyStartYear ?? new Date().getFullYear();
  const y2 = y1 + 1;
  const signPlace = signPlaceDefault || "________________";
  const signDay = signDayDefault || "______";
  const signMonth = signMonthDefault || `July ${y1}`;
  const employeeSigDate = data.signature.signDate
    ? new Date(data.signature.signDate).toLocaleDateString("en-ZA")
    : "______________________";
  const kpaSubtotalCount = data.kpaSummary.reduce((sum, k) => sum + k.count, 0);
  const kpaSubtotalPct = Math.round(data.kpaSummary.reduce((sum, k) => sum + k.weightPct, 0) * 100) / 100;
  const leadingCompetencies = data.competencies.filter((c) => c.groupName === "Leading");
  const coreCompetencies = data.competencies.filter((c) => c.groupName !== "Leading");
  const kpiScaleDesc = (r: number) => KPI_RATING_DESCRIPTIONS[r] ?? "";
  const kpiScaleTerm = (r: number) => ratingScale.find((s) => s.r === r)?.term ?? "—";

  return (
    <div className="agdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      {!isEmbed && <AutoPrint />}

      {!isEmbed && (
        <div className="printbar">
          <PrintButton />
        </div>
      )}

      <table className="pgwrap">
        <tbody>
          <tr>
            <td className="pgbcell">
              <div className="phead">
                <div>
                  <div className="ptitle">{data.municipalityName}</div>
                  <div className="psub">{data.agreementTitle}</div>
                  <div className="psub">
                    Financial year {data.fyLabel} (1 July {y1} to 30 June {y2}) · Generated{" "}
                    {new Date(data.generatedAt).toLocaleDateString("en-ZA")}
                  </div>
                </div>
                <div className="pxmark">
                  Perform<span>Axis</span>
                </div>
              </div>

              {/* Repeats the title/municipality/FY that's already in the
                 masthead above - the reference tool's own repHead() +
                 partiesBlock() double up the same way, since partiesBlock
                 is reused standalone in the interactive (non-print) view
                 where there's no masthead wrapping it at all. */}
              <div className="agparties">
                <div className="agtitle">{data.agreementTitle}</div>
                <div className="agsub">{data.municipalityName}</div>
                <div className="agsub2">
                  Financial year {data.fyLabel} · 1 July {y1} to 30 June {y2}
                </div>
                <table className="agpt">
                  <tbody>
                    <tr>
                      <td className="agk">Entered into by and between:</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td className="agk">The Employer</td>
                      <td>
                        <Mf>{data.municipalityName}</Mf>
                        {data.employerName ? (
                          <>
                            , herein represented by <Mf>{data.employerName}</Mf> in his/her capacity as{" "}
                            <Mf>{data.employerTitle}</Mf>
                          </>
                        ) : (
                          <>
                            , herein represented by the <Mf>{data.employerTitle}</Mf>
                          </>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="agk">and the Employee</td>
                      <td>
                        <Mf>{data.employee.name}</Mf>, in his/her capacity as{" "}
                        <Mf>{data.employee.position ?? "—"}</Mf>
                        {data.employee.empno ? (
                          <>
                            {" "}
                            (employee no. <Mf>{data.employee.empno}</Mf>)
                          </>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="agk">Appointed in terms of</td>
                      <td>Section {sectionNum} of the Local Government: Municipal Systems Act 32 of 2000</td>
                    </tr>
                    <tr>
                      <td className="agk">Period of this agreement</td>
                      <td>
                        1 July {y1} to 30 June {y2}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pact">The parties hereby agree as follows:</div>

              <ClHead n="1">Introduction</ClHead>
              <Cl n="1.1">
                The Employer has entered into a contract of employment with the Employee in terms of section{" "}
                {sectionNum}(1)(a) of the Local Government: Municipal Systems Act 32 of 2000 (&ldquo;the Systems
                Act&rdquo;). The Employer and the Employee are hereinafter referred to as &ldquo;the Parties&rdquo;.
              </Cl>
              <Cl n="1.2">
                Section {sectionNum}(1)(b) of the Systems Act, read with the Contract of Employment concluded between
                the parties, requires the parties to conclude an Annual Performance Agreement.
              </Cl>
              <Cl n="1.3">
                The parties wish to ensure that they are clear about the goals to be achieved, and secure the
                commitment of the Employee to a set of outcomes that will secure Local Government policy goals.
              </Cl>

              <ClHead n="2">Purpose of this agreement</ClHead>
              <Cl n="2.1">The purpose of this agreement is to:</Cl>
              <Cl n="2.2">
                Comply with the provisions of Section {sectionNum}(1)(b), (4B) and (5) of the Systems Act, and the
                Municipal Performance Regulations for Municipal Managers and Managers directly accountable to
                Municipal Managers (2006) as amended by the Regulations on Appointment and Conditions of Employment
                of Senior Managers (<Mf>{signMonth}</Mf>), as well as the Contract of Employment entered into between the
                parties;
              </Cl>
              <Cl n="2.3">
                Specify objectives and targets defined and agreed with the Employee and to communicate to the
                Employee the Employer&rsquo;s expectations of the Employee&rsquo;s performance and accountabilities
                in alignment with the Integrated Development Plan, Service Delivery and Budget Implementation Plan
                (SDBIP) and the Budget of the Employer;
              </Cl>
              <Cl n="2.4">
                Specify accountabilities as set out in the Performance Plan which is appended to this agreement as{" "}
                <b>ANNEXURE A</b>;
              </Cl>
              <Cl n="2.5">Monitor and measure performance against set targeted outputs;</Cl>
              <Cl n="2.6">
                Use the Performance Agreement and Performance Plan as the basis to assess whether the Employee has
                met the performance expectations applicable to his job; and
              </Cl>
              <Cl n="2.7">
                Give effect to the Employer&rsquo;s commitment to a performance-orientated relationship with the
                Employee in attaining equitable and improved service delivery.
              </Cl>

              <ClHead n="3">Commencement and duration</ClHead>
              <Cl n="3.1">
                This Agreement will commence on 1 July <Mf>{y1}</Mf> and will remain in force until 30 June{" "}
                <Mf>{y2}</Mf> where after a new Performance Agreement shall be concluded between the parties for the
                next financial year.
              </Cl>
              <Cl n="3.2">
                The parties will review the provisions of this Agreement during June each year. The parties will
                conclude a new Performance Agreement that replaces this Agreement by not later than the 31st July of
                each successive financial year or any portion thereof.
              </Cl>
              <Cl n="3.3">This Agreement will terminate on the termination of the Employee&rsquo;s contract of employment for any reason.</Cl>
              <Cl n="3.4">
                The content of this Agreement may be revised at any time during the abovementioned period to
                determine the applicability of the matters agreed upon.
              </Cl>

              <ClHead n="4">Performance objectives</ClHead>
              <Cl n="4.1">
                The Performance Plan is attached as <b>ANNEXURE A</b>, and sets out:
              </Cl>
              <Cl n="4.2">The performance objectives and targets that must be met by the Employee; and</Cl>
              <Cl n="4.3">The time frames within which those performance objectives and targets must be met.</Cl>
              <Cl n="4.4">
                The performance objectives reflected in <b>ANNEXURE A</b> are set by the Employer in consultation
                with the Employee and based on the Integrated Development Plan, Service Delivery and Budget
                Implementation Plan (SDBIP) and the Budget of the Employer, and shall include key performance
                indicators, units of measure, details of evidence that must be provided to show that the indicator
                has been achieved, target dates and weightings which show the relative importance of key performance
                indicators to one another.
              </Cl>
              <Cl n="4.5">
                The Employee&rsquo;s performance will, in addition, be measured in terms of contributions to the
                goals and strategies set out in the Employer&rsquo;s Integrated Development Plan.
              </Cl>

              <ClHead n="5">Performance management system</ClHead>
              <Cl n="5.1">
                The Employee agrees to participate in the performance management system that the Employer adopts or
                introduces for the Employer, management and municipal staff of the Employer.
              </Cl>
              <Cl n="5.2">
                The Employee accepts that the purpose of the performance management system will be to provide a
                comprehensive system with specific performance standards to assist the Employer, management and
                municipal staff to perform to the standards required.
              </Cl>
              <Cl n="5.3">
                The Employer will consult the Employee about the specific performance standards that will be
                included in the performance management system as applicable to the Employee.
              </Cl>
              <Cl n="5.4">
                The Employee undertakes to actively focus on the promotion and implementation of the KPA&rsquo;s
                (including special projects relevant to the Employee&rsquo;s responsibilities) within the local
                government framework.
              </Cl>
              <Cl n="5.5">
                The criteria upon which the performance of the Employee shall be assessed shall consist of two
                components, both of which are contained in this Performance Agreement.
              </Cl>
              <Cl n="5.6">
                The Employee must be assessed against both components, with a weighting of {data.policy.kpaWeight}:
                {data.policy.competencyWeight} allocated to the Key Performance Areas (KPA&rsquo;s) and Competencies
                respectively.
              </Cl>
              <Cl n="5.7">Each area of assessment will be weighted and will contribute a specific part to the total score.</Cl>
              <Cl n="5.8">
                KPA&rsquo;s covering the main areas of work will account for {data.policy.kpaWeight}% and
                Competencies will account for {data.policy.competencyWeight}% of the final assessment.
              </Cl>
              <Cl n="5.9">
                The Employee&rsquo;s assessment will be based on his performance in terms of the outputs/outcomes
                (performance indicators) identified as per attached Performance Plan (<b>ANNEXURE A</b>), which are
                linked to the KPA&rsquo;s, and will constitute {data.policy.kpaWeight}% of the overall assessment
                result as per the weightings agreed to between the Employer and Employee. The competencies will make
                up the other {data.policy.competencyWeight}% of the Employee&rsquo;s assessment score.
              </Cl>

              <table className="pt">
                <thead>
                  <tr>
                    <th>Key Performance Area</th>
                    <th className="c">No</th>
                    <th className="c">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kpaSummary.map((k) => (
                    <tr key={k.code}>
                      <td>{k.name}</td>
                      <td className="c">{k.count || ""}</td>
                      <td className="c">{k.weightPct ? `${k.weightPct}%` : ""}</td>
                    </tr>
                  ))}
                  <tr className="pt-total">
                    <td>Sub total</td>
                    <td className="c">{kpaSubtotalCount}</td>
                    <td className="c">{kpaSubtotalPct}%</td>
                  </tr>
                  <tr>
                    <td>Core competencies</td>
                    <td className="c">{data.competencies.length}</td>
                    <td className="c">{data.policy.competencyWeight}%</td>
                  </tr>
                  <tr className="pt-total">
                    <td>Total</td>
                    <td className="c"></td>
                    <td className="c">{kpaSubtotalPct + data.policy.competencyWeight}%</td>
                  </tr>
                </tbody>
              </table>

              <Cl n="5.10">
                The competency framework as set out in the Regulations on Appointment and Conditions of Employment of
                Senior Managers (17 January 2014) consists of six leading competencies which comprise twenty driving
                competencies that communicate what is expected for effective performance in local government, and
                six core competencies that act as drivers to ensure that the leading competencies are executed at an
                optimal level.
              </Cl>

              <table className="pt">
                <thead>
                  <tr>
                    <th>Leading competencies</th>
                    <th>Driving competencies</th>
                  </tr>
                </thead>
                <tbody>
                  {leadingCompetencies.map((c, i) => (
                    <tr key={`${c.name}-${i}`}>
                      <td>
                        {i + 1}. {c.name}
                      </td>
                      <td>
                        {c.drivingText ? (
                          <ul>
                            {c.drivingText.split(";").map((d, j) => (
                              <li key={j}>{d.trim()}</li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="pt-groupHead">
                    <td colSpan={2}>Core competencies</td>
                  </tr>
                  {coreCompetencies.map((c, i) => (
                    <tr key={`${c.name}-${i}`}>
                      <td colSpan={2}>
                        {leadingCompetencies.length + i + 1}. {c.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Cl n="5.11">
                There is no hierarchical connotation to the competencies, and all are essential to the role of a
                senior manager to influence high performance. All competencies will therefore be considered as
                measurable and critical in assessing the level of the Employee&rsquo;s performance.
              </Cl>

              <ClHead n="6">Performance assessment</ClHead>
              <Cl n="6.1">
                The Employee&rsquo;s performance will be measured in terms of contributions to the goals and
                strategies set out in the Employer&rsquo;s Integrated Development Plan (IDP).
              </Cl>
              <Cl n="6.2">The Employee will submit his self-assessment to the Employer prior to the formal assessment;</Cl>
              <Cl n="6.3">Performance assessments will entail:</Cl>
              <Cl n="6.4">
                Assessment of the achievement of results as outlined in the performance plan (<b>ANNEXURE A</b>):
              </Cl>
              <Cl n="6.5">
                Each KPI shall be assessed according to the extent to which the specified standards or performance
                targets have been met and with due regard to ad-hoc tasks that had to be performed under the KPI.
              </Cl>
              <Cl n="6.6">
                The assessment of the performance of the Employee will be based on the following rating scale for
                KPI&rsquo;s:
              </Cl>

              <table className="pt">
                <thead>
                  <tr>
                    <th className="c">Rating</th>
                    <th>Terminology</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <tr key={r}>
                      <td className="c">{r}</td>
                      <td>{kpiScaleTerm(r)}</td>
                      <td>{kpiScaleDesc(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Cl n="6.7">The rating will then be multiplied by the weighting to calculate the final score;</Cl>
              <Cl n="6.8">An overall rating will be calculated based on the total of the individual ratings calculated above.</Cl>
              <Cl n="6.9">
                In the instance where the employee could not perform due to reasons outside the control of the
                employer and employee, the KPI will not be considered during the evaluation. The employee should
                provide sufficient evidence in such instances; and
              </Cl>
              <Cl n="6.10">Assessment of competencies</Cl>
              <Cl n="6.11">
                Each competency shall be assessed according to the extent to which the specified standards for the
                required proficiency level have been met;
              </Cl>
              <Cl n="6.12">
                The assessment of the performance of the Employee will be based on the following rating scale for
                Competencies:
              </Cl>

              <table className="pt">
                <thead>
                  <tr>
                    <th className="c">Rating</th>
                    <th>Achievement level</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[2, 3, 4, 5].map((r) => (
                    <tr key={r}>
                      <td className="c">{r}</td>
                      <td>{COMPETENCY_SCALE_TERMS[r]}</td>
                      <td>{COMPETENCY_RATING_DESCRIPTIONS[r]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Cl n="6.13">
                The rating will then be multiplied by the weighting to calculate the final score. Each competency
                shall carry an equal weighting;
              </Cl>
              <Cl n="6.14">
                A full description of achievement levels per competency is attached as <b>ANNEXURE B</b>.
              </Cl>
              <Cl n="6.15">Overall rating</Cl>
              <Cl n="6.16">
                An overall rating is calculated by combining the KPA and Competency ratings above. Such overall
                rating represents the outcome of the performance appraisal.
              </Cl>
              <Cl n="6.17">
                For purposes of appraising the performance of the Employee, an evaluation panel constituted of the
                following persons will be established, as mutually agreed upon:
              </Cl>
              {isMM ? (
                <>
                  <Cl n="6.18">Executive Mayor or Mayor;</Cl>
                  <Cl n="6.19">
                    Chairperson of the performance audit committee or the audit committee in the absence of a
                    performance audit committee;
                  </Cl>
                  <Cl n="6.20">
                    Member of the mayoral or executive committee or in respect of a plenary type municipality,
                    another member of council;
                  </Cl>
                  <Cl n="6.21">Mayor and/or municipal manager from another municipality; and</Cl>
                  <Cl n="6.22">Member of a ward committee as nominated by the Executive Mayor or Mayor.</Cl>
                </>
              ) : (
                <>
                  <Cl n="6.18">Municipal Manager;</Cl>
                  <Cl n="6.19">
                    Chairperson of the Performance Audit Committee or the Audit Committee in the absence of a
                    Performance Audit Committee;
                  </Cl>
                  <Cl n="6.20">Municipal Manager from another municipality; and</Cl>
                  <Cl n="6.21">Member of the Mayoral Committee (Portfolio Chairperson).</Cl>
                </>
              )}

              <ClHead n="7">Schedule for performance reviews</ClHead>
              <Cl n="7.1">
                The performance of the Employee in relation to his performance agreement shall be reviewed on the
                following dates:
              </Cl>

              <table className="pt">
                <thead>
                  <tr>
                    <th className="c">Quarter</th>
                    <th>Review period</th>
                    <th>Review to be completed by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviewSchedule.map((r) => {
                    const { label, year } = quarterWindowParts(data.fyStartYear, r.quarter);
                    return (
                      <tr key={r.quarter}>
                        <td className="c">{r.quarter}</td>
                        <td>
                          {label} <Mf>{year}</Mf>
                        </td>
                        <td>
                          <Mf>{r.dueDate}</Mf> ({r.reviewType})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <Cl n="7.2">
                Despite the establishment of agreed intervals for evaluation, the Employer may in addition review the
                Employee&rsquo;s performance at any stage while the contract of employment remains in force;
              </Cl>
              <Cl n="7.3">
                Performance reviews in the first and third quarter may be verbal if performance is deemed to be
                satisfactory by the Municipal Manager. In the event of unsatisfactory performance, a panel evaluation
                shall be convened.
              </Cl>
              <Cl n="7.4">
                The Employer shall keep a record of the mid-year, year-end and any other assessment meetings where a
                panel evaluation is convened;
              </Cl>
              <Cl n="7.5">Performance feedback shall be based on the Employer&rsquo;s assessment of the Employee&rsquo;s performance;</Cl>
              <Cl n="7.6">
                The Employer will be entitled to review and make reasonable changes to the provisions of{" "}
                <b>ANNEXURE A</b> from time to time for operational reasons. The Employee will be fully consulted
                before any such change is made; and
              </Cl>
              <Cl n="7.7">
                The Employer may amend the provisions of <b>ANNEXURE A</b> whenever the performance management system
                is adopted, implemented and/or amended as the case may be. In that case, the Employee will be fully
                consulted before any such change is made.
              </Cl>

              <ClHead n="8">Developmental requirements</ClHead>
              <Cl n="8.1">
                Personal growth and development needs identified during any performance appraisal discussion must be
                documented in a Personal Development Plan, in the format set out in <b>ANNEXURE C</b>, as well as the
                actions agreed to and implementation must take place within set time frames;
              </Cl>
              <Cl n="8.2">
                The Personal Development Plan (PDP) for addressing developmental gaps must be developed, if deemed
                necessary in individual cases in consultation with the employee, the Portfolio Councillor and the
                Municipal Manager.
              </Cl>

              <ClHead n="9">Obligations of the employer</ClHead>
              <Cl n="9.1">The Employer shall –</Cl>
              <Cl n="9.2">Create an enabling environment to facilitate effective performance by the employee;</Cl>
              <Cl n="9.3">Provide access to skills development and capacity building opportunities;</Cl>
              <Cl n="9.4">
                Work collaboratively with the Employee to solve problems and generate solutions to common problems
                that may impact on the performance of the Employee;
              </Cl>
              <Cl n="9.5">
                On the request of the Employee delegate such powers reasonably required by the Employee to enable him
                to meet the performance objectives and targets established in terms of this Agreement; and
              </Cl>
              <Cl n="9.6">
                Make available to the Employee such resources as the Employee may reasonably require from time to
                time assisting him to meet the performance objectives and targets established in terms of this
                Agreement.
              </Cl>

              <ClHead n="10">Consultation</ClHead>
              <Cl n="10.1">
                The Employer agrees to consult the Employee timeously where the exercising of powers will have
                amongst others –
              </Cl>
              <Cl n="10.2">A direct effect on the performance of any of the Employee&rsquo;s functions;</Cl>
              <Cl n="10.3">Commit the Employee to implement or to give effect to a decision made by the Employer; and</Cl>
              <Cl n="10.4">A substantial financial effect on the Employer.</Cl>
              <Cl n="10.5">
                The Employer agrees to inform the Employee of the outcome of any decisions taken pursuant to the
                exercise of powers contemplated in clause 10.1 as soon as is practical to enable the Employee to take
                any necessary action.
              </Cl>

              <div className="pbreak" />

              <ClHead n="11">Management of assessment outcomes</ClHead>
              <Cl n="11.1">
                Where the employer is, at any time during the employee&rsquo;s employment, not satisfied with the
                manager&rsquo;s performance in respect of any matter dealt with in this Agreement, the employer will
                give notice to the employee to attend a meeting.
              </Cl>
              <Cl n="11.2">
                The employee will have the opportunity at the meeting to satisfy the employer in respect of the
                measures being taken to ensure that his performance becomes satisfactory and any programme, including
                any dates, for implementing these measures.
              </Cl>
              <Cl n="11.3">
                Where there is a dispute or difference as to the performance of the employee under this Agreement,
                the parties will confer with a view to resolve the dispute or difference.
              </Cl>
              <Cl n="11.4">In the case of unacceptable performance, the employer shall –</Cl>
              <Cl n="11.5">Provide systematic remedial or developmental support to assist the Employee to improve his performance; and</Cl>
              <Cl n="11.6">
                After appropriate performance counselling and having provided the necessary guidance and/or support
                as well as reasonable time for improvement in performance, the Employer may consider steps to
                terminate the contract of employment of the Employee on grounds of unfitness or incapacity to carry
                out his duties.
              </Cl>

              <ClHead n="12">Dispute resolution</ClHead>
              {isMM ? (
                <>
                  <Cl n="12.1">
                    Any disputes about the nature of the employee&rsquo;s performance agreement, whether it relates
                    to key responsibilities, priorities, methods of assessment must be mediated by the MEC for Local
                    Government in the Province or a person designated by him/her within 30 days of receipt of a
                    formal dispute from the employee. The decision of the MEC or his designate shall be final and
                    binding on both parties.
                  </Cl>
                  <Cl n="12.2">
                    Any disputes about the outcomes of the employee&rsquo;s performance evaluation must be mediated
                    by the MEC for Local Government in the Province or a person designated by him/her within 30 days
                    of receipt of a formal dispute from the employee. The decision of the MEC or his designate shall
                    be final and binding on both parties.
                  </Cl>
                </>
              ) : (
                <>
                  <Cl n="12.1">
                    Any disputes about the nature of the employee&rsquo;s performance agreement, whether it relates
                    to key responsibilities, priorities, methods of assessment must be mediated by the Executive
                    Mayor within 30 days of receipt of a formal dispute from the employee. The Executive
                    Mayor&rsquo;s decision shall be final and binding on both parties.
                  </Cl>
                  <Cl n="12.2">
                    Any disputes about the outcomes of the employee&rsquo;s performance evaluation must be mediated
                    by a member of the Municipal Council, provided that such member was not part of the evaluation
                    panel, within 30 days of receipt of a formal dispute from the employee. That member&rsquo;s
                    decision shall be final and binding on both parties.
                  </Cl>
                </>
              )}

              <ClHead n="13">General</ClHead>
              <p style={{ margin: "0 0 8px" }}>
                The contents of this agreement and the outcome of any review conducted in terms of{" "}
                <b>ANNEXURE A</b> may be made available to the public by the Employer.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                Nothing in this agreement diminishes the obligations, duties or accountabilities of the Employee in
                terms of his contract of employment, or the effects of existing or new regulations, circulars,
                policies, directives or other legal instruments.
              </p>

              <div className="sigblock">
                Thus done and signed at <Mf>{signPlace}</Mf> on this the <Mf>{signDay}</Mf> day of <Mf>{signMonth}</Mf>
                {data.signature.status === "signed" && (
                  <span style={{ marginLeft: "8px", color: "#2f7d4f", fontWeight: 700 }}>✓ Signed</span>
                )}
                .
              </div>
              <div className="psign">
                <div className="sigcol">
                  <div className="sigline">
                    AS WITNESSES
                    <br />
                    ______________________
                  </div>
                </div>
                <div className="sigcol">
                  <div className="sigline">
                    <div className="sigrole">{(data.employee.position ?? (isMM ? "Municipal Manager" : "Manager")).toUpperCase()}</div>
                    {data.signature.employeeSignatory || data.employee.name} · Date: {employeeSigDate}
                  </div>
                </div>
              </div>

              <div className="sigblock" style={{ marginTop: "18px" }}>
                Thus done and signed at <Mf>{signPlace}</Mf> on this the <Mf>{signDay}</Mf> day of <Mf>{signMonth}</Mf>.
              </div>
              <div className="psign">
                <div className="sigcol">
                  <div className="sigline">
                    AS WITNESSES
                    <br />
                    ______________________
                  </div>
                </div>
                <div className="sigcol">
                  <div className="sigline">
                    <div className="sigrole">{data.employerTitle.toUpperCase()}</div>
                    {data.signature.employerSignatory || data.employerName || "______________________"} · Date:{" "}
                    {employeeSigDate}
                  </div>
                </div>
              </div>

              <div className="pbreak" />

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
