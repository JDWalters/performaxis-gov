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

export type ScorecardOption = { id: string; label: string; orgId: string };

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
  kpi_library: { calc_config: { lower?: boolean; acc?: string } | null } | null;
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
 */
export async function getSdbipDashboard(
  scorecardId: string | undefined,
  period: Period
): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: scorecardRows, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org:orgs(id, name, code)");
  if (scErr) throw scErr;

  const scorecards = (scorecardRows ?? []) as unknown as ScorecardRow[];
  const options: ScorecardOption[] = [
    { id: "top", label: "Top Layer SDBIP", orgId: "" },
    ...scorecards
      .filter((s) => s.org)
      .map((s) => ({ id: s.id, label: `${s.org!.name} — Departmental SDBIP`, orgId: s.org!.id, code: s.org!.code }))
      .sort(
        (a, b) => departmentSortKey(a.code) - departmentSortKey(b.code) || a.label.localeCompare(b.label)
      )
      .map(({ id, label, orgId }) => ({ id, label, orgId })),
  ];

  const selected = scorecardId && scorecardId !== "top" ? scorecardId : "top";
  const selectedOption = options.find((o) => o.id === selected) ?? options[0];

  let query = supabase
    .from("scorecard_kpis")
    .select(
      "id, ref_code, name, kpa, scorecard_id, kpi_library:kpi_library_id(calc_config), kpi_targets(quarter, target_value), kpi_results(quarter, actual, comment, corrective_action)"
    );
  if (selected !== "top") query = query.eq("scorecard_id", selected);

  const { data: kpiRows, error: kpiErr } = await query;
  if (kpiErr) throw kpiErr;

  const orgByScorecard = new Map(scorecards.filter((s) => s.org).map((s) => [s.id, s.org!]));
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
    const lower = k.kpi_library?.calc_config?.lower ?? false;
    const acc: Accumulation = accOf(k.kpi_library?.calc_config?.acc);
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
