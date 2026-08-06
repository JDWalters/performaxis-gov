import { NextResponse } from "next/server";
import { getMyProfile } from "@/lib/data/access";
import { getCsvExportRows } from "@/lib/data/appraisals";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Downloads a CSV of every accessible employee's indicators, targets, final ratings and N/A flags - the reference's exportCsv(). */
export async function GET() {
  const me = await getMyProfile();
  if (!me?.user) return new NextResponse("Not authenticated", { status: 401 });

  const rows = await getCsvExportRows();
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performaxis-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
