import { createClient } from "@/lib/supabase/server";

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
};

type ScorecardListRow = {
  id: string;
  org: { id: string; name: string } | null;
  scorecard_kpis: { id: string }[];
};

/** Every department scorecard the signed-in user can see (RLS-scoped via has_org_access). */
export async function getScorecardsList(): Promise<ScorecardListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scorecards")
    .select("id, org:orgs(id, name), scorecard_kpis(id)");
  if (error) throw error;

  const rows = (data ?? []) as unknown as ScorecardListRow[];

  return rows
    .filter((r) => r.org)
    .map((r) => ({
      scorecardId: r.id,
      orgId: r.org!.id,
      orgName: r.org!.name,
      kpiCount: (r.scorecard_kpis ?? []).length,
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
}

/**
 * Mirrors the "calc" object inside kpi_library.calc_config, migrated from the
 * legacy SDBIP register. Drives which capture inputs the form shows instead of
 * one free-text box for every KPI, e.g. a Yes/No selector for "yesno" KPIs
 * rather than someone typing "1 (Achieved)".
 */
export type KpiCalc = {
  type: "yesno" | "single" | "ratio" | "three" | string;
  labels?: string[];
  x100?: boolean;
  den?: number;
  unit?: string;
  formula?: string;
};

export type CaptureKpi = {
  id: string;
  refCode: string | null;
  name: string;
  kpa: string | null;
  unitOfMeasure: string | null;
  targetType: string;
  target: string | null;
  calc: KpiCalc | null;
  result: {
    actual: string | null;
    inputs: Record<string, unknown>;
    evidenceUrl: string | null;
    comment: string | null;
    correctiveAction: string | null;
  } | null;
};

export type ScorecardDetail = {
  scorecardId: string;
  orgId: string;
  orgName: string;
  quarter: number;
  canCapture: boolean;
  kpis: CaptureKpi[];
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
  kpi_library: { calc_config: { calc?: KpiCalc } | null } | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: {
    quarter: number;
    actual: string | null;
    inputs: Record<string, unknown> | null;
    evidence_url: string | null;
    comment: string | null;
    corrective_action: string | null;
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
      "id, ref_code, name, kpa, unit_of_measure, target_type, kpi_library:kpi_library_id(calc_config), kpi_targets(quarter, target_value), kpi_results(quarter, actual, inputs, evidence_url, comment, corrective_action)"
    )
    .eq("scorecard_id", scorecardId);
  if (kpiErr) throw kpiErr;

  // Cast: same pragmatic workaround as the upsert cast in scorecards/actions.ts -
  // the generic rpc() overload doesn't always resolve cleanly against the
  // generated Functions map across postgrest-js versions.
  const { data: canCaptureData } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null }>
  )("has_org_access", {
    target_org_id: header.org.id,
    required_permission: "capture_kpi_results",
  });

  const kpiRows = (kpis ?? []) as unknown as ScorecardKpiRow[];

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
        calc: k.kpi_library?.calc_config?.calc ?? null,
        result: result
          ? {
              actual: result.actual,
              inputs: result.inputs ?? {},
              evidenceUrl: result.evidence_url,
              comment: result.comment,
              correctiveAction: result.corrective_action,
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
    kpis: rows,
  };
}
