import { createClient } from "@/lib/supabase/server";
import type { KpiCalc, AppraisalKpi } from "@/lib/data/appraisals-shared";

export type { KpiCalc, AppraisalKpi } from "@/lib/data/appraisals-shared";
export { friendlyAppraisalActual } from "@/lib/data/appraisals-shared";

export type AppraisalListItem = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  fyLabel: string;
  kpiCount: number;
};

type AppraisalListRow = {
  id: string;
  employee: { name: string; position: string | null; org: { name: string } | null } | null;
  financial_year: { label: string } | null;
  appraisal_kpis: { id: string }[];
};

/** Every appraisal cycle the signed-in user can see (RLS-scoped via has_employee_access). */
export async function getAppraisalsList(): Promise<AppraisalListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee:employees(name, position, org:orgs(name)), financial_year:financial_years(label), appraisal_kpis(id)"
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as AppraisalListRow[];

  return rows
    .filter((r) => r.employee)
    .map((r) => ({
      cycleId: r.id,
      employeeName: r.employee!.name,
      position: r.employee!.position,
      orgName: r.employee!.org?.name ?? "—",
      fyLabel: r.financial_year?.label ?? "—",
      kpiCount: (r.appraisal_kpis ?? []).length,
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
}

export type AppraisalDetail = {
  cycleId: string;
  employeeId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  fyLabel: string;
  quarter: number;
  canCapture: boolean;
  kpis: AppraisalKpi[];
};

type AppraisalHeaderRow = {
  id: string;
  employee_id: string;
  employee: { name: string; position: string | null; org: { name: string } | null } | null;
  financial_year: { label: string } | null;
};

type AppraisalKpiRow = {
  id: string;
  name: string;
  kpa: string | null;
  unit_of_measure: string | null;
  weight: string | null;
  baseline: string | null;
  annual_target: string | null;
  poe: string | null;
  calc_config: { calc?: KpiCalc } | null;
  appraisal_ratings: {
    quarter: number;
    actual: string | null;
    inputs: Record<string, unknown> | null;
    target_value: string | null;
    na: boolean | null;
    evidence_url: string | null;
    comment: string | null;
    corrective_action: string | null;
    self_rating: number | null;
    mgr_rating: number | null;
    panel_rating: number | null;
  }[];
};

/**
 * A single employee's appraisal cycle for a given quarter, with each KPI's
 * quarter target and any already-captured result, plus whether the signed-in
 * user can write results here (checked live via has_employee_access, same
 * RPC family backing the RLS policies).
 */
export async function getAppraisalDetail(
  cycleId: string,
  quarter: number
): Promise<AppraisalDetail | null> {
  const supabase = await createClient();

  const { data: cycle, error: cycleErr } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee_id, employee:employees(name, position, org:orgs(name)), financial_year:financial_years(label)"
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  const header = cycle as unknown as AppraisalHeaderRow | null;
  if (!header || !header.employee) return null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select(
      "id, name, kpa, unit_of_measure, weight, baseline, annual_target, poe, calc_config, appraisal_ratings(quarter, actual, inputs, target_value, na, evidence_url, comment, corrective_action, self_rating, mgr_rating, panel_rating)"
    )
    .eq("appraisal_cycle_id", cycleId);
  if (kpiErr) throw kpiErr;

  // Cast: same pragmatic workaround used for the rpc() call in scorecards.ts.
  const { data: canCaptureData } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null }>
  )("has_employee_access", {
    target_employee_id: header.employee_id,
    required_permission: "capture_appraisal_ratings",
  });

  const kpiRows = (kpis ?? []) as unknown as AppraisalKpiRow[];

  const rows: AppraisalKpi[] = kpiRows
    .map((k) => {
      const result = (k.appraisal_ratings ?? []).find((r) => r.quarter === quarter);
      return {
        id: k.id,
        name: k.name,
        kpa: k.kpa,
        unitOfMeasure: k.unit_of_measure,
        weight: k.weight,
        baseline: k.baseline,
        annualTarget: k.annual_target,
        poe: k.poe,
        calc: k.calc_config?.calc ?? null,
        result: result
          ? {
              actual: result.actual,
              inputs: result.inputs ?? {},
              targetValue: result.target_value,
              na: result.na ?? false,
              evidenceUrl: result.evidence_url,
              comment: result.comment,
              correctiveAction: result.corrective_action,
              selfRating: result.self_rating,
              mgrRating: result.mgr_rating,
              panelRating: result.panel_rating,
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    cycleId: header.id,
    employeeId: header.employee_id,
    employeeName: header.employee.name,
    position: header.employee.position,
    orgName: header.employee.org?.name ?? "—",
    fyLabel: header.financial_year?.label ?? "—",
    quarter,
    canCapture: Boolean(canCaptureData),
    kpis: rows,
  };
}
