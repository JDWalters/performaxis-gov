import { NextResponse } from "next/server";
import { getMyProfile } from "@/lib/data/access";
import { getScorecardsList, getScorecardDetail, getScorecardRegisterData } from "@/lib/data/scorecards";
import { registerCsvRows, reportCsvRows, toCsv } from "@/lib/data/scorecard-csv";
import { createZip, type ZipEntry } from "@/lib/zip";

const QUARTER_LABEL: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

function safeName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

/**
 * Downloads a ZIP containing every accessible scorecard's full register CSV
 * plus its Q1-Q4 report CSVs, one folder per scorecard - the server-side
 * equivalent of the reference's client-side "Export ALL reports to CSV
 * (ZIP)" button, built with the same STORE-method zip format but generated
 * in the route handler instead of the browser.
 */
export async function GET() {
  const me = await getMyProfile();
  if (!me?.user) return new NextResponse("Not authenticated", { status: 401 });

  const encoder = new TextEncoder();
  const scorecards = await getScorecardsList();
  const files: ZipEntry[] = [];

  for (const sc of scorecards) {
    const folder = `${safeName(sc.orgName)}/`;
    const register = await getScorecardRegisterData(sc.scorecardId);
    if (register) {
      files.push({
        name: `${folder}00_Register_AllQuarters.csv`,
        data: encoder.encode(toCsv(registerCsvRows(register.orgName, register.kpis))),
      });
    }
    for (const quarter of [1, 2, 3, 4]) {
      const detail = await getScorecardDetail(sc.scorecardId, quarter);
      if (!detail) continue;
      const label = QUARTER_LABEL[quarter];
      const c88Codes = detail.kpis.map((k) => k.c88Code);
      files.push({
        name: `${folder}${label}_Report.csv`,
        data: encoder.encode(toCsv(reportCsvRows(detail.orgName, label, detail.kpis, c88Codes))),
      });
    }
  }

  if (files.length === 0) return new NextResponse("No accessible scorecards", { status: 404 });

  const zipBytes = createZip(files);
  const filename = `PerformAxis_Scorecards_${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Blob([new Uint8Array(zipBytes)]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
