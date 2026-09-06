import { createClient } from "@/lib/supabase/server";
import type { KpiCalc, CaptureKpi } from "@/lib/data/scorecards-shared";
import { needsReview } from "@/lib/data/kpi-calc-shared";

export type { KpiCalc, CaptureKpi } from "@/lib/data/scorecards-shared";
export { friendlyActual } from "@/lib/data/scorecards-shared";

/**
 * Natural sort for ref codes like "FMS2" / "FMS11" / "CMS5.1" - plain string
 * sort puts "FMS11" before "FMS2" because "1" < "2" lexicographically. This
 * compares the letter and number segments separately so numbers compare
 * numerically.
 */
function naturalCompare(a: string, b: string): number {
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

export type ScorecardListItem = {
  scorecardId: string;
  orgId: string;
  orgName: string;
  kpiCount: number;
  needsReviewCount: number;
};

type ScorecardListRow = {
  id: string;
  org: { id: string; name: string } | null;
  scorecard_kpis: {
    id: string;
    calc_config: { calc?: KpiCalc } | null;
    kpi_results: { actual: string | null }[];
  }[];
};

/**
 * Every department scorecard the signed-in user can see (RLS-scoped via
 * has_org_access). financialYearId narrows to one year's scorecards - see
 * the same reasoning in getSdbipDashboard() in sdbip-dashboard.ts. Omitting
 * it returns every scorecard regardless of year (this function's original
 * behaviour, still used wherever a caller hasn't been updated to pass a
 * financial year yet).
 */
export async function getScorecardsList(financialYearId?: string | null): Promise<ScorecardListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("scorecards")
    .select("id, org:orgs(id, name), scorecard_kpis(id, calc_config, kpi_results(actual))");
  if (financialYearId) query = query.eq("financial_year_id", financialYearId);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as ScorecardListRow[];

  return rows
    .filter((r) => r.org)
    .map((r) => {
      const kpis = r.scorecard_kpis ?? [];
      const calcOf = (k: ScorecardListRow["scorecard_kpis"][number]) => k.calc_config?.calc ?? null;
      const needsReviewCount = kpis.reduce(
        (n, k) => n + (k.kpi_results ?? []).filter((res) => needsReview(res.actual, calcOf(k))).length,
        0
      );
      return {
        scorecardId: r.id,
        orgId: r.org!.id,
        orgName: r.org!.name,
        kpiCount: kpis.length,
        needsReviewCount,
      };
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
}

export type ScorecardDetail = {
  scorecardId: string;
  orgId: string;
  orgName: string;
  quarter: number;
  canCapture: boolean;
  canManageSetup: boolean;
  kpis: CaptureKpi[];
  /** Quarters (1-4) with at least one legacy value that needs re-capturing - drives a dot on the quarter tabs. */
  quartersNeedingReview: number[];
};

type ScorecardHeaderRow = {
  id: string;
  org: { id: string; name: string } | null;
};

type ScorecardKpiRow = {
  id: string;
  ref_code: string | null;
  name: string;
  kpa: string | null;
  unit_of_measure: string | null;
  target_type: string;
  kpi_library_id: string | null;
  // The KPI's answer-type/lower-is-better/accumulation setup lives here, on
  // this specific scorecard placement - not on kpi_library, which is only
  // ever a starting template copied in when the KPI was added (see
  // kpi-admin-actions.ts). Two placements of the "same" KPI on different
  // departments or financial years each carry their own independent copy.
  calc_config: { calc?: KpiCalc; lower?: boolean; acc?: string } | null;
  // Scorecard-setup narrative fields, per placement - see CaptureKpi in
  // scorecards-shared.ts for why these live here and not on kpi_library.
  method: string | null;
  kpi_type: string | null;
  wards: string | null;
  baseline: string | null;
  annual_target: string | null;
  poe: string | null;
  kpi_library: { c88_code: string | null } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: {
    quarter: number;
    actual: string | null;
    inputs: Record<string, unknown> | null;
    evidence_url: string | null;
    evidence_description: string | null;
    comment: string | null;
    corrective_action: string | null;
    corrective_action_owner: string | null;
    corrective_action_due: string | null;
  }[];
};

/**
 * A single department scorecard for a given quarter, with each KPI's target and
 * any already-captured result for that quarter, plus whether the signed-in user
 * is allowed to write results here (checked live via the has_org_access RPC that
 * also backs the RLS policies, so the UI and the database agree).
 */
export async function getScorecardDetail(
  scorecardId: string,
  quarter: number
): Promise<ScorecardDetail | null> {
  const supabase = await createClient();

  const { data: scorecard, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org:orgs(id, name)")
    .eq("id", scorecardId)
    .maybeSingle();
  if (scErr) throw scErr;

  const header = scorecard as unknown as ScorecardHeaderRow | null;
  if (!header || !header.org) return null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("scorecard_kpis")
    .select(
      "id, ref_code, name, kpa, unit_of_measure, target_type, kpi_library_id, calc_config, method, kpi_type, wards, baseline, annual_target, poe, kpi_library:kpi_library_id(c88_code), kpi_targets(quarter, target_value), kpi_results(quarter, actual, inputs, evidence_url, evidence_description, comment, corrective_action, corrective_action_owner, corrective_action_due)"
    )
    .eq("scorecard_id", scorecardId);
  if (kpiErr) throw kpiErr;

  // Cast: same pragmatic workaround as the upsert cast in scorecards/actions.ts -
  // the generic rpc() overload doesn't always resolve cleanly against the
  // generated Functions map across postgrest-js versions.
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: boolean | null }>;
  const [{ data: canCaptureData }, { data: canManageSetupData }] = await Promise.all([
    rpc("has_org_access", { target_org_id: header.org.id, required_permission: "capture_kpi_results" }),
    rpc("has_org_access", { target_org_id: header.org.id, required_permission: "manage_scorecard_setup" }),
  ]);

  const kpiRows = (kpis ?? []) as unknown as ScorecardKpiRow[];

  const quartersNeedingReview = [...new Set(
    kpiRows.flatMap((k) =>
      (k.kpi_results ?? [])
        .filter((r) => needsReview(r.actual, k.calc_config?.calc ?? null))
        .map((r) => r.quarter)
    )
  )].sort((a, b) => a - b);

  const rows: CaptureKpi[] = kpiRows
    .map((k) => {
      const target = (k.kpi_targets ?? []).find((t) => t.quarter === quarter);
      const result = (k.kpi_results ?? []).find((r) => r.quarter === quarter);
      return {
        id: k.id,
        refCode: k.ref_code,
        name: k.name,
        kpa: k.kpa,
        unitOfMeasure: k.unit_of_measure,
        targetType: k.target_type,
        target: target?.target_value ?? null,
        lower: k.calc_config?.lower ?? false,
        calc: k.calc_config?.calc ?? null,
        acc: k.calc_config?.acc ?? null,
        method: k.method,
        kpiType: k.kpi_type,
        wards: k.wards,
        baseline: k.baseline,
        annualTarget: k.annual_target,
        poe: k.poe,
        libraryId: k.kpi_library_id,
        c88Code: k.kpi_library?.c88_code ?? null,
        quarters: [1, 2, 3, 4].map((q) => ({
          quarter: q,
          target: (k.kpi_targets ?? []).find((t) => t.quarter === q)?.target_value ?? null,
          actual: (k.kpi_results ?? []).find((r) => r.quarter === q)?.actual ?? null,
        })),
        result: result
          ? {
              actual: result.actual,
              inputs: result.inputs ?? {},
              evidenceUrl: result.evidence_url,
              evidenceDescription: result.evidence_description,
              comment: result.comment,
              correctiveAction: result.corrective_action,
              correctiveActionOwner: result.corrective_action_owner,
              correctiveActionDue: result.corrective_action_due,
            }
          : null,
      };
    })
    .sort((a, b) => naturalCompare(a.refCode ?? "", b.refCode ?? ""));

  return {
    scorecardId: header.id,
    orgId: header.org.id,
    orgName: header.org.name,
    quarter,
    canCapture: Boolean(canCaptureData),
    canManageSetup: Boolean(canManageSetupData),
    kpis: rows,
    quartersNeedingReview,
  };
}

export type RegisterExportData = {
  orgName: string;
  kpis: {
    refCode: string | null;
    c88Code: string | null;
    kpa: string | null;
    name: string;
    unitOfMeasure: string | null;
    targetType: string;
    lower: boolean;
    calc: KpiCalc | null;
    method: string | null;
    kpiType: string | null;
    wards: string | null;
    baseline: string | null;
    annualTarget: string | null;
    poe: string | null;
    quarters: {
      target: string | null;
      actual: string | null;
      comment: string | null;
      correctiveAction: string | null;
      correctiveActionOwner: string | null;
      correctiveActionDue: string | null;
    }[];
  }[];
};

/**
 * All 4 quarters' targets/results for every KPI on a scorecard, in one
 * shot - used only for CSV register export, where getScorecardDetail's
 * single-quarter shape isn't enough.
 */
export async function getScorecardRegisterData(scorecardId: string): Promise<RegisterExportData | null> {
  const supabase = await createClient();

  const { data: scorecard, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org:orgs(id, name)")
    .eq("id", scorecardId)
    .maybeSingle();
  if (scErr) throw scErr;
  const header = scorecard as unknown as ScorecardHeaderRow | null;
  if (!header || !header.org) return null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("scorecard_kpis")
    .select(
      "id, ref_code, name, kpa, unit_of_measure, target_type, calc_config, method, kpi_type, wards, baseline, annual_target, poe, kpi_library:kpi_library_id(c88_code), kpi_targets(quarter, target_value), kpi_results(quarter, actual, comment, corrective_action, corrective_action_owner, corrective_action_due)"
    )
    .eq("scorecard_id", scorecardId);
  if (kpiErr) throw kpiErr;

  type Row = {
    id: string;
    ref_code: string | null;
    name: string;
    kpa: string | null;
    unit_of_measure: string | null;
    target_type: string;
    calc_config: { calc?: KpiCalc; lower?: boolean } | null;
    method: string | null;
    kpi_type: string | null;
    wards: string | null;
    baseline: string | null;
    annual_target: string | null;
    poe: string | null;
    kpi_library: { c88_code: string | null } | null;
    kpi_targets: { quarter: number; target_value: string | null }[];
    kpi_results: {
      quarter: number;
      actual: string | null;
      comment: string | null;
      corrective_action: string | null;
      corrective_action_owner: string | null;
      corrective_action_due: string | null;
    }[];
  };

  const rows = ((kpis ?? []) as unknown as Row[])
    .map((k) => ({
      refCode: k.ref_code,
      c88Code: k.kpi_library?.c88_code ?? null,
      kpa: k.kpa,
      name: k.name,
      unitOfMeasure: k.unit_of_measure,
      targetType: k.target_type,
      lower: k.calc_config?.lower ?? false,
      calc: k.calc_config?.calc ?? null,
      method: k.method,
      kpiType: k.kpi_type,
      wards: k.wards,
      baseline: k.baseline,
      annualTarget: k.annual_target,
      poe: k.poe,
      quarters: [1, 2, 3, 4].map((q) => {
        const target = (k.kpi_targets ?? []).find((t) => t.quarter === q);
        const result = (k.kpi_results ?? []).find((r) => r.quarter === q);
        return {
          target: target?.target_value ?? null,
          actual: result?.actual ?? null,
          comment: result?.comment ?? null,
          correctiveAction: result?.corrective_action ?? null,
          correctiveActionOwner: result?.corrective_action_owner ?? null,
          correctiveActionDue: result?.corrective_action_due ?? null,
        };
      }),
    }))
    .sort((a, b) => naturalCompare(a.refCode ?? "", b.refCode ?? ""));

  return { orgName: header.org.name, kpis: rows };
}
