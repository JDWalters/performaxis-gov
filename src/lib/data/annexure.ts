import { createClient } from "@/lib/supabase/server";
import { kpaRank } from "@/lib/data/kpa-shared";

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

export type AgreementSignature = {
  employeeSignatory: string | null;
  employerSignatory: string | null;
  signPlace: string | null;
  signDate: string | null;
  status: "draft" | "signed";
};

const BLANK_SIGNATURE: AgreementSignature = {
  employeeSignatory: null,
  employerSignatory: null,
  signPlace: null,
  signDate: null,
  status: "draft",
};

export type AnnexureData = {
  cycleId: string;
  employeeName: string;
  /** Same has_employee_access("capture_appraisal_ratings") check the RLS write policies enforce - the reference tool's single "admin" role, mapped onto our real RBAC. */
  canEdit: boolean;
  kpis: AnnexureKpi[];
  totalWeight: number;
  agreement: AgreementSignature;
  /** True only via org-level sign_agreements (a real manager) - gates the employer signatory field. Same distinction as canManagerRate on the Ratings tab. */
  canSignAsEmployer: boolean;
  /** canSignAsEmployer OR the signed-in user is this exact employee (employee_only membership) - gates the employee signatory field. */
  canSignAsEmployee: boolean;
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
  created_at: string;
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

  const { data: agreementRow } = await supabase
    .from("agreements")
    .select("employee_signatory, employer_signatory, sign_place, sign_date, status")
    .eq("appraisal_cycle_id", cycleId)
    .maybeSingle();
  const agreementData = agreementRow as unknown as {
    employee_signatory: string | null;
    employer_signatory: string | null;
    sign_place: string | null;
    sign_date: string | null;
    status: "draft" | "signed";
  } | null;
  const agreement: AgreementSignature = agreementData
    ? {
        employeeSignatory: agreementData.employee_signatory,
        employerSignatory: agreementData.employer_signatory,
        signPlace: agreementData.sign_place,
        signDate: agreementData.sign_date,
        status: agreementData.status,
      }
    : BLANK_SIGNATURE;

  // canSignAsEmployer checks org-level access only (has_org_access) -
  // matches canManagerRate on the Ratings tab. canSignAsEmployee additionally
  // admits the employee's own employee_only-scoped self-service membership.
  const { data: cycleOrgRow } = await supabase
    .from("employees")
    .select("org_id")
    .eq("id", header.employee_id)
    .maybeSingle();
  const employeeOrgId = (cycleOrgRow as unknown as { org_id: string } | null)?.org_id ?? null;

  const { data: canSignEmployerData } = employeeOrgId
    ? await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: boolean | null }>
      )("has_org_access", { target_org_id: employeeOrgId, required_permission: "sign_agreements" })
    : { data: false };
  const canSignAsEmployer = Boolean(canSignEmployerData);

  const { data: selfMembershipData } = await supabase
    .from("memberships")
    .select("id")
    .eq("employee_id", header.employee_id)
    .limit(1);
  const canSignAsEmployee = canSignAsEmployer || Boolean((selfMembershipData ?? []).length);

  const { data: kpis, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select(
      "id, kpa, name, unit_of_measure, baseline, annual_target, poe, weight, weight_locked, created_at, appraisal_ratings(quarter, target_value)"
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
  const annexureKpis: AnnexureKpi[] = [...rows]
    // Grouped by KPA in the regulatory order, then by capture order within
    // each KPA - matches the reference tool and the other KPI lists in this
    // app (Assessment ratings, the printed agreement), not alphabetical.
    .sort((a, b) => {
      const ra = kpaRank(a.kpa);
      const rb = kpaRank(b.kpa);
      if (ra !== rb) return ra - rb;
      return a.created_at.localeCompare(b.created_at);
    })
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
    });

  const totalWeight = Math.round(annexureKpis.reduce((sum, k) => sum + (k.weight || 0), 0) * 100) / 100;

  return {
    cycleId: header.id,
    employeeName: header.employee.name,
    canEdit: Boolean(canEditData),
    kpis: annexureKpis,
    totalWeight,
    agreement,
    canSignAsEmployer,
    canSignAsEmployee,
  };
}
