/**
 * Pure CSV builders for scorecard exports (register + per-period report),
 * mirroring the reference tool's registerCsvLines()/reportCsvLines() shape
 * but built from our own data layer's CaptureKpi/status helpers. No
 * framework imports - reused identically by both the per-scorecard CSV
 * route handlers and the "export everything" ZIP.
 */
import type { CaptureKpi } from "@/lib/data/scorecards-shared";
import { friendlyActualValue } from "@/lib/data/kpi-calc-shared";
import { statusFor, STATUS_META, type Status } from "@/lib/data/sdbip-status";

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

/** One quarter's worth of target/result data for a single KPI, used to build the register CSV's per-quarter columns. */
export type RegisterQuarterCell = {
  target: string | null;
  actual: string | null;
  comment: string | null;
  correctiveAction: string | null;
  correctiveActionOwner: string | null;
  correctiveActionDue: string | null;
};

export type RegisterKpiRow = {
  refCode: string | null;
  c88Code: string | null;
  kpa: string | null;
  name: string;
  unitOfMeasure: string | null;
  targetType: string;
  lower: boolean;
  calc: CaptureKpi["calc"];
  quarters: RegisterQuarterCell[];
};

const REGISTER_HEADER = [
  "Ref",
  "Circular 88",
  "KPA",
  "Key Performance Indicator",
  "Unit of Measure",
  "Target Type",
  "Q1 Target",
  "Q1 Result",
  "Q1 Assessment",
  "Q2 Target",
  "Q2 Result",
  "Q2 Assessment",
  "Q3 Target",
  "Q3 Result",
  "Q3 Assessment",
  "Q4 Target",
  "Q4 Result",
  "Q4 Assessment",
  "Latest Comment",
  "Latest Corrective Action",
  "Corrective Action Owner",
  "Corrective Action Due",
];

/** Full-year register: one row per KPI, all 4 quarters' targets/results/assessment side by side. */
export function registerCsvRows(orgName: string, rows: RegisterKpiRow[]): string[][] {
  const out: string[][] = [[`Register — ${orgName}`], REGISTER_HEADER];
  for (const row of rows) {
    const quarterCols: string[] = [];
    let latestComment = "";
    let latestCorrective = "";
    let latestOwner = "";
    let latestDue = "";
    row.quarters.forEach((q) => {
      const status: Status = q.target ? statusFor(q.actual, q.target, row.lower) : "pending";
      quarterCols.push(
        q.target ?? "",
        friendlyActualValue(q.actual, row.calc) ?? "",
        q.target ? STATUS_META[status].label : ""
      );
      if (q.comment) latestComment = q.comment;
      if (q.correctiveAction) latestCorrective = q.correctiveAction;
      if (q.correctiveActionOwner) latestOwner = q.correctiveActionOwner;
      if (q.correctiveActionDue) latestDue = q.correctiveActionDue;
    });
    out.push([
      row.refCode ?? "",
      row.c88Code ?? "",
      row.kpa ?? "",
      row.name,
      row.unitOfMeasure ?? "",
      row.targetType,
      ...quarterCols,
      latestComment,
      latestCorrective,
      latestOwner,
      latestDue,
    ]);
  }
  return out;
}

const REPORT_HEADER = [
  "Ref",
  "Circular 88",
  "KPA",
  "Key Performance Indicator",
  "Target",
  "Result",
  "Assessment",
  "Comment",
  "Corrective Action",
  "CA Owner",
  "Due Date",
];

/** One quarter's (or period's) report: the same shape shown on the capture/scorecard screen for that period. */
export function reportCsvRows(orgName: string, periodLabel: string, kpis: CaptureKpi[], c88Codes: (string | null)[]): string[][] {
  const out: string[][] = [[`${periodLabel} Report — ${orgName}`], REPORT_HEADER];
  kpis.forEach((kpi, i) => {
    const hasTarget = Boolean(kpi.target && kpi.target.trim());
    const status: Status = hasTarget ? statusFor(kpi.result?.actual, kpi.target, kpi.lower) : "pending";
    out.push([
      kpi.refCode ?? "",
      c88Codes[i] ?? "",
      kpi.kpa ?? "",
      kpi.name,
      kpi.target ?? "N/A",
      friendlyActualValue(kpi.result?.actual, kpi.calc) ?? "",
      hasTarget ? STATUS_META[status].label : "Not yet reportable",
      kpi.result?.comment ?? "",
      kpi.result?.correctiveAction ?? "",
      kpi.result?.correctiveActionOwner ?? "",
      kpi.result?.correctiveActionDue ?? "",
    ]);
  });
  return out;
}
