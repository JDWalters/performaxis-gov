import { NextResponse } from "next/server";
import { getMyProfile } from "@/lib/data/access";
import { getScorecardDetail } from "@/lib/data/scorecards";
import { reportCsvRows, toCsv } from "@/lib/data/scorecard-csv";

const QUARTER_LABEL: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

/** Downloads one quarter's report CSV for one scorecard - mirrors the reference's per-quarter "csv-report" buttons. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMyProfile();
  if (!me?.user) return new NextResponse("Not authenticated", { status: 401 });

  const { id } = await params;
  const q = new URL(req.url).searchParams.get("q");
  const quarter = Math.min(4, Math.max(1, Number(q) || 4));

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) return new NextResponse("Scorecard not found", { status: 404 });

  const label = QUARTER_LABEL[quarter] ?? `Q${quarter}`;
  const c88Codes = detail.kpis.map((k) => k.c88Code);
  const csv = toCsv(reportCsvRows(detail.orgName, label, detail.kpis, c88Codes));
  const filename = `${label}_Report_${detail.orgName.replace(/[^a-z0-9]+/gi, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
