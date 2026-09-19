import { createClient } from "@/lib/supabase/server";
import {
  statusFor,
  statusForPeriod,
  effectiveValue,
  accOf,
  emptyTally,
  pctOf,
  type Period,
  type Status,
  type StatusTally,
  type Accumulation,
} from "@/lib/data/sdbip-status";

export type ScorecardOption = {
  id: string;
  label: string;
  orgId: string;
  orgName?: string;
  orgCode?: string | null;
  /** True when this option is the Top Layer SDBIP - a real scorecard scoped to the municipality-level org itself (orgs.kind = 'municipality'), not a computed rollup. */
  isTopLayer?: boolean;
};

export type AttentionKpi = {
  refCode: string | null;
  orgName: string;
  name: string;
  target: string | null;
  result: string | null;
  status: Status;
  correctiveCaptured: boolean;
  correctiveNote: string | null;
};

export type DashboardData = {
  scorecards: ScorecardOption[];
  selectedScorecardId: string;
  selectedLabel: string;
  /** True when the selected scorecard is the Top Layer SDBIP - drives the department-breakdown view and Dept column, same as the old `selectedScorecardId === "top"` check, but now backed by a real scorecard rather than a synthesized id. */
  isTopLayer: boolean;
  period: Period;
  kpiCount: number;
  tally: StatusTally;
  pctAchieved: number | null;
  quarterTrend: { quarter: number; pct: number | null }[];
  departments: {
    orgId: string;
    orgName: string;
    orgCode: string | null;
    kpiCount: number;
    tally: StatusTally;
    pctAchieved: number | null;
    quarterPct: (number | null)[];
  }[];
  kpas: { kpa: string; kpiCount: number; tally: StatusTally; pctAchieved: number | null }[];
  attention: AttentionKpi[];
};

type Row = {
  id: string;
  ref_code: string | null;
  name: string;
  kpa: string | null;
  scorecard_id: string;
  dept_org_id: string | null;
  dept: { id: string; name: string; code: string | null } | null;
  calc_config: { lower?: boolean; acc?: string } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: {
    quarter: number;
    actual: string | null;
    comment: string | null;
    corrective_action: string | null;
  }[];
};

type ScorecardRow = { id: string; org: { id: string; name: string; code: string | null; kind: string } | null };

// Standard SA municipal SDBIP reporting order: MM's office, then Finance,
// Corporate, Technical, Community - not alphabetical. Falls back to
// alphabetical for any department code outside this fixed list. Exported so
// other rollup views (e.g. performance-progress.ts) sort departments the
// same way instead of re-deriving this ordering.
export const DEPARTMENT_ORDER = ["OMM", "FMS", "CRS", "TS", "CMS"];
export function departmentSortKey(code: string | null): number {
  const i = code ? DEPARTMENT_ORDER.indexOf(code) : -1;
  return i === -1 ? DEPARTMENT_ORDER.length : i;
}

export function quarterArray<R extends { quarter: number }, T>(rows: R[], pick: (r: R) => T, fallback: T): T[] {
  return [1, 2, 3, 4].map((q) => {
    const row = rows.find((r) => r.quarter === q);
    return row ? pick(row) : fallback;
  });
}

/**
 * The picker options for every scorecard the signed-in user can see in one
 * financial year: the real Top Layer SDBIP (scorecards.org_id = the
 * municipality-level org, orgs.kind = 'municipality') plus each department's
 * own scorecard. Both kinds are ordinary rows in the same `scorecards` table
 * now - Top Layer used to be a synthesized `{ id: "top" }` pseudo-option that
 * live-aggregated every department's KPIs; the client's own reference tool
 * confirmed Top Layer is instead a real, independently-captured register
 * (its own KPI codes like OMM1/FMS1, its own quarterly figures), so this
 * just reads it like any other scorecard and tags it via isTopLayer for
 * callers that still need to special-case its presentation (department
 * breakdown view, Dept column, etc).
 */
export async function getScorecardOptions(financialYearId?: string | null): Promise<ScorecardOption[]> {
  const supabase = await createClient();

  let scorecardsQuery = supabase.from("scorecards").select("id, org:orgs(id, name, code, kind)");
  if (financialYearId) scorecardsQuery = scorecardsQuery.eq("financial_year_id", financialYearId);
  const { data: scorecardRows, error: scErr } = await scorecardsQuery;
  if (scErr) throw scErr;

  const scorecards = (scorecardRows ?? []) as unknown as ScorecardRow[];
  return scorecards
    .filter((s) => s.org)
    .map((s) => {
      const isTopLayer = s.org!.kind === "municipality";
      return {
        id: s.id,
        label: isTopLayer ? "Top Layer SDBIP" : `${s.org!.name} — Departmental SDBIP`,
        orgId: s.org!.id,
        orgName: s.org!.name,
        orgCode: s.org!.code,
        isTopLayer,
      };
    })
    .sort((a, b) =>
      a.isTopLayer !== b.isTopLayer
        ? a.isTopLayer
          ? -1
          : 1
        : departmentSortKey(a.orgCode) - departmentSortKey(b.orgCode) || a.label.localeCompare(b.label)
    );
}

// Same numbers-before-letters ref-code sort as scorecards.ts's naturalCompare
// (not exported from there) - kept as its own tiny copy here rather than
// threading an export through, since this is the only other place that needs
// it (the print report's detailed KPI table, sorted "FMS2" before "FMS11").
function naturalCompareRef(a: string, b: string): number {
  const tokenize = (s: string) => s.match(/(\d+(?:\.\d+)?)|(\D+)/g) ?? [];
  const ta = tokenize(a);
  const tb = tokenize(b);
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i++) {
    const xa = ta[i] ?? "";
    const xb = tb[i] ?? "";
    const na = Number(xa);
    const nb = Number(xb);
    const bothNumeric = xa !== "" && xb !== "" && !Number.isNaN(na) && !Number.isNaN(nb);
    if (bothNumeric) {
      if (na !== nb) return na - nb;
    } else if (xa !== xb) {
      return xa < xb ? -1 : 1;
    }
  }
  return 0;
}

export type ReportKpi = {
  scorecardId: string;
  orgName: string;
  orgCode: string | null;
  refCode: string | null;
  name: string;
  kpa: string | null;
  unit: string | null;
  target: string | null;
  actual: string | null;
  status: Status;
  correctiveNote: string | null;
};

type ReportRow = {
  id: string;
  ref_code: string | null;
  name: string;
  kpa: string | null;
  unit_of_measure: string | null;
  scorecard_id: string;
  dept_org_id: string | null;
  dept: { id: string; name: string; code: string | null } | null;
  calc_config: { lower?: boolean; acc?: string } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: { quarter: number; actual: string | null; corrective_action: string | null }[];
};

/**
 * Every KPI's period-effective target/actual/status, flat (not aggregated) -
 * feeds the print report's detailed KPI table. Same underlying rows and
 * status logic as getSdbipDashboard() above (deliberately not reusing
 * getScorecardDetail() here - that also runs two has_org_access RPCs and
 * signs evidence-file URLs per KPI, both pointless for a read-only report
 * that never lets you capture from it). A scorecardId that doesn't resolve
 * to one of this financial year's options falls back to the Top Layer
 * scorecard, same as getSdbipDashboard() below.
 */
export async function getSdbipReportKpis(
  scorecardId: string | undefined,
  period: Period,
  financialYearId?: string | null
): Promise<ReportKpi[]> {
  const supabase = await createClient();

  const options = await getScorecardOptions(financialYearId);
  const topOption = options.find((o) => o.isTopLayer);
  const selectedOption = options.find((o) => o.id === scorecardId) ?? topOption ?? options[0];
  const isTop = Boolean(selectedOption?.isTopLayer);

  let kpiRows: unknown[] | null = [];
  if (selectedOption) {
    const { data, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, ref_code, name, kpa, unit_of_measure, scorecard_id, dept_org_id, dept:orgs!scorecard_kpis_dept_org_id_fkey(id, name, code), calc_config, kpi_targets(quarter, target_value), kpi_results(quarter, actual, corrective_action)"
      )
      .eq("scorecard_id", selectedOption.id);
    if (kpiErr) throw kpiErr;
    kpiRows = data;
  }

  const rows = (kpiRows ?? []) as unknown as ReportRow[];
  const qIdx = period === "mid" ? 1 : period === "annual" ? 3 : period - 1;

  return rows
    .map((k) => {
      const lower = k.calc_config?.lower ?? false;
      const acc: Accumulation = accOf(k.calc_config?.acc);
      const targets = quarterArray(k.kpi_targets ?? [], (r) => r.target_value, null);
      const actuals = quarterArray(k.kpi_results ?? [], (r) => r.actual, null);
      const status = statusForPeriod(actuals, targets, lower, acc, period);
      const value = effectiveValue(actuals, qIdx, acc);
      // On the Top Layer scorecard, "org" for display purposes is the KPI's
      // own department tag (dept_org_id) - independent data, not a join back
      // to a department scorecard. On an ordinary department scorecard it's
      // just that scorecard's own org.
      const orgName = isTop ? (k.dept?.name ?? "—") : (selectedOption?.orgName ?? "—");
      const orgCode = isTop ? (k.dept?.code ?? null) : (selectedOption?.orgCode ?? null);
      const resultRow = (k.kpi_results ?? []).find((r) => r.quarter === qIdx + 1);
      return {
        scorecardId: k.scorecard_id,
        orgName,
        orgCode,
        refCode: k.ref_code,
        name: k.name,
        kpa: k.kpa,
        unit: k.unit_of_measure,
        target: targets[qIdx],
        actual: value === null ? actuals[qIdx] : String(value),
        status,
        correctiveNote: resultRow?.corrective_action ?? null,
      };
    })
    .sort(
      (a, b) =>
        departmentSortKey(a.orgCode) - departmentSortKey(b.orgCode) ||
        a.orgName.localeCompare(b.orgName) ||
        naturalCompareRef(a.refCode ?? "", b.refCode ?? "")
    );
}

export async function getSdbipDashboard(
  scorecardId: string | undefined,
  period: Period,
  financialYearId?: string | null
): Promise<DashboardData> {
  const supabase = await createClient();

  const options = await getScorecardOptions(financialYearId);
  const topOption = options.find((o) => o.isTopLayer);

  // A scorecard id from a different financial year (e.g. a stale ?sc= link
  // left over from before switching years), or no id at all, falls back to
  // the Top Layer scorecard instead of silently rendering another year's
  // single-department view under this year's label.
  const selectedOption = options.find((o) => o.id === scorecardId) ?? topOption ?? options[0];
  const selected = selectedOption?.id ?? "";
  const isTop = Boolean(selectedOption?.isTopLayer);

  let kpiRows: unknown[] | null = [];
  if (selected) {
    const { data, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, ref_code, name, kpa, scorecard_id, dept_org_id, dept:orgs!scorecard_kpis_dept_org_id_fkey(id, name, code), calc_config, kpi_targets(quarter, target_value), kpi_results(quarter, actual, comment, corrective_action)"
      )
      .eq("scorecard_id", selected);
    if (kpiErr) throw kpiErr;
    kpiRows = data;
  }

  const rows = (kpiRows ?? []) as unknown as Row[];

  const tally = emptyTally();
  const quarterTallies = [emptyTally(), emptyTally(), emptyTally(), emptyTally()];
  const deptMap = new Map<
    string,
    { orgName: string; orgCode: string | null; kpiCount: number; tally: StatusTally; quarterTallies: StatusTally[] }
  >();
  const kpaMap = new Map<string, { kpiCount: number; tally: StatusTally }>();
  const attention: AttentionKpi[] = [];

  for (const k of rows) {
    const lower = k.calc_config?.lower ?? false;
    const acc: Accumulation = accOf(k.calc_config?.acc);
    const targets = quarterArray(k.kpi_targets ?? [], (r) => r.target_value, null);
    const actuals = quarterArray(k.kpi_results ?? [], (r) => r.actual, null);

    const status = statusForPeriod(actuals, targets, lower, acc, period);
    tally[status]++;

    // The "by department" breakdown groups by the KPI's own department tag
    // when viewing the Top Layer scorecard (dept_org_id, independent of any
    // department scorecard), or by the scorecard's single org otherwise.
    const org = isTop
      ? k.dept
        ? { id: k.dept.id, name: k.dept.name, code: k.dept.code }
        : null
      : selectedOption
        ? { id: selectedOption.orgId, name: selectedOption.orgName ?? "—", code: selectedOption.orgCode ?? null }
        : null;
    if (org) {
      if (!deptMap.has(org.id)) {
        deptMap.set(org.id, {
          orgName: org.name,
          orgCode: org.code,
          kpiCount: 0,
          tally: emptyTally(),
          quarterTallies: [emptyTally(), emptyTally(), emptyTally(), emptyTally()],
        });
      }
      const d = deptMap.get(org.id)!;
      d.kpiCount++;
      d.tally[status]++;
    }

    const kpaKey = k.kpa || "—";
    if (!kpaMap.has(kpaKey)) kpaMap.set(kpaKey, { kpiCount: 0, tally: emptyTally() });
    const kpaEntry = kpaMap.get(kpaKey)!;
    kpaEntry.kpiCount++;
    kpaEntry.tally[status]++;

    // Always-on quarter-by-quarter trend uses each quarter's own status, independent of the selected period.
    for (let q = 0; q < 4; q++) {
      const qStatus = statusFor(actuals[q], targets[q], lower);
      quarterTallies[q][qStatus]++;
      if (org) deptMap.get(org.id)!.quarterTallies[q][qStatus]++;
    }

    if (status === "missed" || status === "almost") {
      const qIdx = period === "mid" ? 1 : period === "annual" ? 3 : period - 1;
      const value = effectiveValue(actuals, qIdx, acc);
      const resultRow = (k.kpi_results ?? []).find((r) => r.quarter === qIdx + 1);
      attention.push({
        refCode: k.ref_code,
        orgName: org?.name ?? "—",
        name: k.name,
        target: targets[qIdx],
        result: value === null ? (actuals[qIdx] ?? null) : String(value),
        status,
        correctiveCaptured: Boolean(resultRow?.corrective_action?.trim()),
        correctiveNote: resultRow?.corrective_action ?? null,
      });
    }
  }

  return {
    scorecards: options,
    selectedScorecardId: selected,
    selectedLabel: selectedOption?.label ?? "Top Layer SDBIP",
    isTopLayer: isTop,
    period,
    kpiCount: rows.length,
    tally,
    pctAchieved: pctOf(tally),
    quarterTrend: quarterTallies.map((t, i) => ({ quarter: i + 1, pct: pctOf(t) })),
    departments: [...deptMap.entries()]
      .map(([orgId, d]) => ({
        orgId,
        orgName: d.orgName,
        orgCode: d.orgCode,
        kpiCount: d.kpiCount,
        tally: d.tally,
        pctAchieved: pctOf(d.tally),
        quarterPct: d.quarterTallies.map((t) => pctOf(t)),
      }))
      .sort((a, b) => departmentSortKey(a.orgCode) - departmentSortKey(b.orgCode) || a.orgName.localeCompare(b.orgName)),
    kpas: [...kpaMap.entries()]
      .map(([kpa, v]) => ({ kpa, kpiCount: v.kpiCount, tally: v.tally, pctAchieved: pctOf(v.tally) }))
      .sort((a, b) => a.kpa.localeCompare(b.kpa)),
    attention: attention.sort((a, b) => (a.status === "missed" ? -1 : 1) - (b.status === "missed" ? -1 : 1)),
  };
}
