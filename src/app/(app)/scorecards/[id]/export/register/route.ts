import { NextResponse } from "next/server";
import { getMyProfile } from "@/lib/data/access";
import { getScorecardRegisterData } from "@/lib/data/scorecards";
import { registerCsvRows, toCsv } from "@/lib/data/scorecard-csv";

/** Downloads the full-year register CSV (all 4 quarters, all KPIs) for one scorecard - mirrors the reference's "Export CSV" register button. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMyProfile();
  if (!me?.user) return new NextResponse("Not authenticated", { status: 401 });

  const { id } = await params;
  const data = await getScorecardRegisterData(id);
  if (!data) return new NextResponse("Scorecard not found", { status: 404 });

  const csv = toCsv(registerCsvRows(data.orgName, data.kpis));
  const filename = `Register_${data.orgName.replace(/[^a-z0-9]+/gi, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
