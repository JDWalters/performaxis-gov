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

export type ScorecardOption = { id: string; label: string; orgId: string; orgName?: string; orgCode?: string | null };

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
  calc_config: { lower?: boolean; acc?: string } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: {
    quarter: number;
    actual: string | null;
    comment: string | null;
    corrective_action: string | null;
  }[];
};

type ScorecardRow = { id: string; org: { id: string; name: string; code: string | null } | null };

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
 * The SDBIP performance dashboard's full rollup for a chosen scorecard
 * ("top" = every department combined, matching the reference app's "Top
 * Layer SDBIP") and period (a single quarter, "mid" = as-of-Q2, or "annual"
 * = as-of-Q4). Computed live from kpi_targets/kpi_results using the same
 * 5-tier statusFor() classification as the client's reference prototype.
 *
 * financialYearId scopes everything to one year's scorecards - each
 * financial year has its own independent scorecard row per department (see
 * scorecards.financial_year_id), so "top" must only aggregate the KPIs that
 * belong to *this* year's scorecards, never every year's at once. Omitting
 * it (or the signed-in user having no municipality-level org yet) falls back
 * to every scorecard regardless of year, matching this function's original,
 * pre-financial-year behaviour.
 */
/**
 * The picker options for every department scorecard the signed-in user can
 * see (plus the "Top Layer SDBIP" pseudo-option), scoped to one financial
 * year - factored out of getSdbipDashboard() so a caller that only needs the
 * options list (e.g. a department switcher on the scorecard detail page)
 * doesn't have to pull the full KPI rollup just to build a <select>.
 */
export async function getScorecardOptions(financialYearId?: string | null): Promise<ScorecardOption[]> {
  const supabase = await createClient();

  let scorecardsQuery = supabase.from("scorecards").select("id, org:orgs(id, name, code)");
  if (financialYearId) scorecardsQuery = scorecardsQuery.eq("financial_year_id", financialYearId);
  const { data: scorecardRows, error: scErr } = await scorecardsQuery;
  if (scErr) throw scErr;

  const scorecards = (scorecardRows ?? []) as unknown as ScorecardRow[];
  return [
    { id: "top", label: "Top Layer SDBIP", orgId: "" },
    ...scorecards
      .filter((s) => s.org)
      .map((s) => ({
        id: s.id,
        label: `${s.org!.name} — Departmental SDBIP`,
        orgId: s.org!.id,
        orgName: s.org!.name,
        orgCode: s.org!.code,
      }))
      .sort(
        (a, b) => departmentSortKey(a.orgCode) - departmentSortKey(b.orgCode) || a.label.localeCompare(b.label)
      ),
  ];
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
 * that never lets you capture from it). "top" pulls every scorecard in the
 * financial year, same fallback rule as getSdbipDashboard().
 */
export async function getSdbipReportKpis(
  scorecardId: string | undefined,
  period: Period,
  financialYearId?: string | null
): Promise<ReportKpi[]> {
  const supabase = await createClient();

  const options = await getScorecardOptions(financialYearId);
  const scorecardIdsInYear = options.filter((o) => o.id !== "top").map((o) => o.id);
  const selected =
    scorecardId && scorecardId !== "top" && scorecardIdsInYear.includes(scorecardId) ? scorecardId : "top";
  const targetIds = selected !== "top" ? [selected] : scorecardIdsInYear;

  let kpiRows: unknown[] | null = [];
  if (targetIds.length > 0) {
    const { data, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, ref_code, name, kpa, unit_of_measure, scorecard_id, calc_config, kpi_targets(quarter, target_value), kpi_results(quarter, actual, corrective_action)"
      )
      .in("scorecard_id", targetIds);
    if (kpiErr) throw kpiErr;
    kpiRows = data;
  }

  const orgByScorecard = new Map(
    options.filter((o) => o.id !== "top").map((o) => [o.id, { name: o.orgName!, code: o.orgCode ?? null }])
  );
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
      const org = orgByScorecard.get(k.scorecard_id);
      const resultRow = (k.kpi_results ?? []).find((r) => r.quarter === qIdx + 1);
      return {
        scorecardId: k.scorecard_id,
        orgName: org?.name ?? "—",
        orgCode: org?.code ?? null,
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
  const scorecardIdsInYear = options.filter((o) => o.id !== "top").map((o) => o.id);

  // A scorecard id from a different financial year (e.g. a stale ?sc= link
  // left over from before switching years) falls back to "top" instead of
  // silently rendering another year's single-department view under this
  // year's label.
  const selected =
    scorecardId && scorecardId !== "top" && scorecardIdsInYear.includes(scorecardId) ? scorecardId : "top";
  const selectedOption = options.find((o) => o.id === selected) ?? options[0];

  let kpiRows: unknown[] | null = [];
  if (selected !== "top") {
    const { data, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, ref_code, name, kpa, scorecard_id, calc_config, kpi_targets(quarter, target_value), kpi_results(quarter, actual, comment, corrective_action)"
      )
      .eq("scorecard_id", selected);
    if (kpiErr) throw kpiErr;
    kpiRows = data;
  } else if (scorecardIdsInYear.length > 0) {
    const { data, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, ref_code, name, kpa, scorecard_id, calc_config, kpi_targets(quarter, target_value), kpi_results(quarter, actual, comment, corrective_action)"
      )
      .in("scorecard_id", scorecardIdsInYear);
    if (kpiErr) throw kpiErr;
    kpiRows = data;
  }

  const orgByScorecard = new Map(
    options
      .filter((o) => o.id !== "top")
      .map((o) => [o.id, { id: o.orgId, name: o.orgName!, code: o.orgCode ?? null }])
  );
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

    const org = orgByScorecard.get(k.scorecard_id);
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
    selectedLabel: selectedOption.label,
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
