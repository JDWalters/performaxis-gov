import { notFound } from "next/navigation";
import { getPdpData } from "@/lib/data/pdp";
import { AutoPrint, PrintButton } from "@/app/(print)/_shared/PrintControls";

const REPORT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 11mm; }
}
* { box-sizing: border-box; }
body { margin: 0; }
.pdpdoc { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: #17313a; font-size: 10.5pt; }
.phead { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1.5pt solid #a97f2a; padding-bottom: 6px; margin-bottom: 14px; }
.ptitle { font-size: 16pt; font-weight: 800; color: #17313a; }
.psub { font-size: 9.5pt; color: #3c5560; margin-top: 2px; }
.pxmark { font-size: 9pt; font-weight: 700; color: #17313a; text-align: right; }
.pxmark span { color: #a97f2a; }
table.pt { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 8.5pt; }
table.pt th { background: #eef1f1; color: #17313a; font-weight: 700; text-align: left; padding: 5px 6px; border: 0.5pt solid #d8e0dd; font-size: 8pt; }
table.pt td { padding: 5px 6px; border: 0.5pt solid #d8e0dd; vertical-align: top; }
table.pt tr:nth-child(even) td { background: #fbfbfb; }
.c { text-align: center; }
.daychip { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; font-size: 9pt; font-weight: 700; }
.daychip.ok { background: #e3f3e8; color: #2f7d4f; }
.daychip.warn { background: #fdf1e2; color: #a97f2a; }
.printbar { display: flex; justify-content: flex-end; padding: 10px 16px; }
@media print { .printbar { display: none; } }
`;

export default async function PdpReportPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const data = await getPdpData(cycleId);
  if (!data) notFound();

  const meetsGuideline = data.totalDays >= 5;

  return (
    <div className="pdpdoc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <AutoPrint />
      <div className="printbar">
        <PrintButton />
      </div>

      <div className="phead">
        <div>
          <div className="ptitle">Personal Development Plan</div>
          <div className="psub">
            {data.employeeName} · Financial year {data.fyLabel}
          </div>
          <div className="psub">Generated {new Date().toLocaleDateString("en-ZA")}</div>
        </div>
        <div className="pxmark">
          Perform<span>Axis</span>
        </div>
      </div>

      {data.items.length === 0 ? (
        <p>No development needs recorded.</p>
      ) : (
        <table className="pt">
          <thead>
            <tr>
              <th>Priority</th>
              <th>1. Skills / gap</th>
              <th>2. Outcomes expected</th>
              <th>3. Suggested activity</th>
              <th>4. Mode</th>
              <th>5. Time frame</th>
              <th>6. Work opportunity</th>
              <th>7. Support person</th>
              <th>Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id}>
                <td>{it.priority ?? "—"}</td>
                <td>{it.gap ?? "—"}</td>
                <td>{it.outcome ?? "—"}</td>
                <td>{it.activity ?? "—"}</td>
                <td>{it.mode ?? "—"}</td>
                <td>{it.timeframe ?? "—"}</td>
                <td>{it.opportunity ?? "—"}</td>
                <td>{it.supportPerson ?? "—"}</td>
                <td>{it.days ?? "—"}</td>
                <td>{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`daychip ${meetsGuideline ? "ok" : "warn"}`}>
        Total planned training days: {data.totalDays.toFixed(1)}
        {meetsGuideline ? " ✓ meets the five-day guideline" : " — guideline is at least five days per financial year"}
      </div>
    </div>
  );
}
