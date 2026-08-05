import { createClient } from "@/lib/supabase/server";
import {
  statusFor,
  parseNum,
  emptyTally,
  pctOf,
  trendOf,
  trendOfStatuses,
  type Status,
  type StatusTally,
  type Trend,
} from "@/lib/data/sdbip-status";
import { departmentSortKey, quarterArray, type ScorecardOption } from "@/lib/data/sdbip-dashboard";

export type { ScorecardOption };

export type QuarterCell = {
  quarter: number;
  target: string | null;
  actual: string | null;
  status: Status;
  pctOfTarget: number | null;
};

export type ProgressKpi = {
  id: string;
  refCode: string | null;
  name: string;
  kpa: string | null;
  orgId: string;
  orgName: string;
  orgCode: string | null;
  quarters: QuarterCell[];
  trend: Trend;
  comment: string | null;
  correctiveAction: string | null;
};

export type GroupCard = {
  key: string;
  label: string;
  kpiCount: number;
  quarterPct: (number | null)[];
  trend: Trend;
};

export type ProgressData = {
  scorecards: ScorecardOption[];
  selectedScorecardId: string;
  selectedLabel: string;
  kpis: ProgressKpi[];
  kpaGroups: GroupCard[];
  deptGroups: GroupCard[];
};

type Row = {
  id: string;
  ref_code: string | null;
  name: string;
  kpa: string | null;
  scorecard_id: string;
  kpi_library: { calc_config: { lower?: boolean } | null } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: { quarter: number; actual: string | null; comment: string | null; corrective_action: string | null }[];
};

type ScorecardRow = { id: string; org: { id: string; name: string; code: string | null } | null };

function pctOfTarget(actual: string | null, target: string | null): number | null {
  const a = parseNum(actual);
  const t = parseNum(target);
  if (a.num === null || t.num === null || t.num === 0) return null;
  return Math.round((a.num / t.num) * 100);
}

/**
 * Flat per-KPI quarterly trend data for the Performance Progress page (By
 * KPI / By KPA / By department views) - built on the same statusFor()
 * classification as the SDBIP dashboard, just kept at per-KPI granularity
 * (with comment/corrective text) instead of pre-aggregated into tallies.
 */
export async function getPerformanceProgress(scorecardId: string | undefined): Promise<ProgressData> {
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
      .sort((a, b) => departmentSortKey(a.code) - departmentSortKey(b.code) || a.label.localeCompare(b.label))
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

  const kpis: ProgressKpi[] = rows.map((k) => {
    const lower = k.kpi_library?.calc_config?.lower ?? false;
    const targets = quarterArray(k.kpi_targets ?? [], (r) => r.target_value, null);
    const actuals = quarterArray(k.kpi_results ?? [], (r) => r.actual, null);
    const org = orgByScorecard.get(k.scorecard_id);

    const quarters: QuarterCell[] = [1, 2, 3, 4].map((q) => {
      const target = targets[q - 1];
      const actual = actuals[q - 1];
      return {
        quarter: q,
        target,
        actual,
        status: statusFor(actual, target, lower),
        pctOfTarget: pctOfTarget(actual, target),
      };
    });

    // Most recently captured quarter's own comment/corrective action - what
    // a reviewer scanning the table actually wants to read for context.
    const lastCaptured = [...(k.kpi_results ?? [])].filter((r) => r.actual).sort((a, b) => b.quarter - a.quarter)[0];

    return {
      id: k.id,
      refCode: k.ref_code,
      name: k.name,
      kpa: k.kpa,
      orgId: org?.id ?? "",
      orgName: org?.name ?? "—",
      orgCode: org?.code ?? null,
      quarters,
      trend: trendOfStatuses(quarters.map((q) => q.status)),
      comment: lastCaptured?.comment ?? null,
      correctiveAction: lastCaptured?.corrective_action ?? null,
    };
  });

  function buildGroups(keyOf: (k: ProgressKpi) => string | null): GroupCard[] {
    const map = new Map<string, { label: string; kpiCount: number; quarterTallies: StatusTally[] }>();
    for (const k of kpis) {
      const key = keyOf(k);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          label: key,
          kpiCount: 0,
          quarterTallies: [emptyTally(), emptyTally(), emptyTally(), emptyTally()],
        });
      }
      const g = map.get(key)!;
      g.kpiCount++;
      k.quarters.forEach((q, i) => g.quarterTallies[i][q.status]++);
    }
    return [...map.entries()].map(([key, g]) => {
      const quarterPct = g.quarterTallies.map((t) => pctOf(t));
      return { key, label: g.label, kpiCount: g.kpiCount, quarterPct, trend: trendOf(quarterPct) };
    });
  }

  const kpaGroups = buildGroups((k) => k.kpa).sort((a, b) => a.label.localeCompare(b.label));
  const deptGroups = buildGroups((k) => k.orgCode ?? k.orgName)
    .map((g) => {
      // Recover the real org name for the label (grouped by code, but code
      // isn't display-friendly) - any KPI in the group carries it.
      const sample = kpis.find((k) => (k.orgCode ?? k.orgName) === g.key);
      return { ...g, label: sample?.orgName ?? g.label };
    })
    .sort((a, b) => departmentSortKey(a.key) - departmentSortKey(b.key) || a.label.localeCompare(b.label));

  return {
    scorecards: options,
    selectedScorecardId: selected,
    selectedLabel: selectedOption.label,
    kpis: kpis.sort((a, b) => (a.refCode ?? "").localeCompare(b.refCode ?? "", undefined, { numeric: true })),
    kpaGroups,
    deptGroups,
  };
}
