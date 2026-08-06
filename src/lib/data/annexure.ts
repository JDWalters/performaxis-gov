import { createClient } from "@/lib/supabase/server";

export type AnnexureKpi = {
  id: string;
  kpa: string | null;
  name: string;
  unitOfMeasure: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
  weight: number;
  weightLocked: boolean;
  quarterlyTargets: [string | null, string | null, string | null, string | null];
};

export type AnnexureData = {
  cycleId: string;
  employeeName: string;
  /** Same has_employee_access("capture_appraisal_ratings") check the RLS write policies enforce - the reference tool's single "admin" role, mapped onto our real RBAC. */
  canEdit: boolean;
  kpis: AnnexureKpi[];
  totalWeight: number;
};

type CycleHeaderRow = {
  id: string;
  employee_id: string;
  employee: { name: string } | null;
};

type AnnexureKpiRow = {
  id: string;
  kpa: string | null;
  name: string;
  unit_of_measure: string | null;
  baseline: string | null;
  annual_target: string | null;
  poe: string | null;
  weight: number;
  weight_locked: boolean;
  appraisal_ratings: { quarter: number; target_value: string | null }[];
};

/**
 * The editable Annexure A (performance plan) for one employee's cycle -
 * every KPI's KPA/name/unit/baseline/annual target/quarterly targets/weight,
 * plus whether the signed-in user can edit it here (same permission that
 * gates capturing ratings - the reference tool's "admin" role owns both the
 * plan and the ratings, and our RLS write policies already enforce this
 * exact rule, so this mirrors it rather than inventing a separate check).
 */
export async function getAnnexureData(cycleId: string): Promise<AnnexureData | null> {
  const supabase = await createClient();

  const { data: cycle, error: cycleErr } = await supabase
    .from("appraisal_cycles")
    .select("id, employee_id, employee:employees(name)")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  const header = cycle as unknown as CycleHeaderRow | null;
  if (!header || !header.employee) return null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select(
      "id, kpa, name, unit_of_measure, baseline, annual_target, poe, weight, weight_locked, appraisal_ratings(quarter, target_value)"
    )
    .eq("appraisal_cycle_id", cycleId);
  if (kpiErr) throw kpiErr;

  // Cast-and-call in one expression - splitting this across two statements
  // breaks supabase.rpc's `this` binding (see the production incidents
  // documented in users.ts/orgs.ts).
  const { data: canEditData } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null }>
  )("has_employee_access", {
    target_employee_id: header.employee_id,
    required_permission: "capture_appraisal_ratings",
  });

  const rows = (kpis ?? []) as unknown as AnnexureKpiRow[];
  const annexureKpis: AnnexureKpi[] = rows
    .map((r) => {
      const byQuarter = (q: number) => (r.appraisal_ratings ?? []).find((x) => x.quarter === q)?.target_value ?? null;
      return {
        id: r.id,
        kpa: r.kpa,
        name: r.name,
        unitOfMeasure: r.unit_of_measure,
        baseline: r.baseline,
        annualTarget: r.annual_target,
        poe: r.poe,
        weight: r.weight,
        weightLocked: r.weight_locked,
        quarterlyTargets: [byQuarter(1), byQuarter(2), byQuarter(3), byQuarter(4)] as AnnexureKpi["quarterlyTargets"],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalWeight = Math.round(annexureKpis.reduce((sum, k) => sum + (k.weight || 0), 0) * 100) / 100;

  return {
    cycleId: header.id,
    employeeName: header.employee.name,
    canEdit: Boolean(canEditData),
    kpis: annexureKpis,
    totalWeight,
  };
}
