import { createClient } from "@/lib/supabase/server";
import { getPolicyConfig, defaultReviewDate, REVIEW_TYPE, type PolicyConfig } from "@/lib/data/policy";
import { NATIONAL_KPAS } from "@/lib/data/kpa-shared";
import type { Tables } from "@/lib/supabase/types";

type EmployeeRole = Tables<"employees">["role"];

export type AgreementKpi = {
  kpa: string | null;
  name: string;
  unitOfMeasure: string | null;
  baseline: string | null;
  annualTarget: string | null;
  quarterlyTargets: [string | null, string | null, string | null, string | null];
  weight: string | null;
  poe: string | null;
};

export type AgreementCompetency = {
  name: string;
  groupName: string | null;
  drivingText: string | null;
};

export type ReviewScheduleRow = {
  quarter: number;
  reviewType: string;
  dueDate: string;
};

export type KpaSummaryRow = {
  code: string;
  name: string;
  count: number;
  weightPct: number;
};

export type AgreementData = {
  cycleId: string;
  municipalityName: string;
  /** The org this agreement's municipality-wide template fields (place/day/month, review dates) belong to - null if it couldn't be resolved. */
  municipalityOrgId: string | null;
  /** has_org_access(municipalityOrgId, 'manage_org_setup') - gates the inline "Agreement details" panel on the interactive page. */
  canEditAgreementTemplate: boolean;
  fyLabel: string;
  fyStartYear: number | null;
  reviewSchedule: ReviewScheduleRow[];
  employee: {
    name: string;
    position: string | null;
    empno: string | null;
    contract: string | null;
    orgName: string;
    role: EmployeeRole;
  };
  /** "Section 57" for the Municipal Manager, "Section 56" for everyone else - derived purely from employee.role, per the Regulations. */
  agreementSection: "Section 57" | "Section 56";
  agreementTitle: string;
  employerTitle: string;
  employerName: string | null;
  kpis: AgreementKpi[];
  totalWeight: number;
  /** Each national KPA's indicator count and combined weight - the agreement's clause 5.9 KPA_TABLE. */
  kpaSummary: KpaSummaryRow[];
  competencies: AgreementCompetency[];
  policy: PolicyConfig;
  generatedAt: string;
  signature: {
    employeeSignatory: string | null;
    employerSignatory: string | null;
    signPlace: string | null;
    signDate: string | null;
    status: "draft" | "signed";
  };
};

type AgreementCycleRow = {
  id: string;
  employee_id: string;
  employee: {
    name: string;
    position: string | null;
    empno: string | null;
    contract: string | null;
    role: EmployeeRole;
    org: { name: string; parent_id: string | null } | null;
  } | null;
  financial_year: { label: string; start_year: number | null } | null;
};

type AgreementKpiRow = {
  kpa: string | null;
  name: string;
  unit_of_measure: string | null;
  baseline: string | null;
  annual_target: string | null;
  weight: string | null;
  poe: string | null;
  appraisal_ratings: { quarter: number; target_value: string | null }[];
};

type CompetencyRow = {
  name: string;
  group_name: string | null;
  driving_text: string | null;
};

/**
 * Everything the printable Performance Agreement (Annexure A + B) needs for
 * one employee's cycle - annual and per-quarter targets side by side (not
 * just whichever quarter happens to be selected on screen), the full
 * competency framework, and the org's live policy config (rating scale,
 * weight split, bonus bands) so the document never drifts from what the app
 * itself is scoring against.
 */
export async function getAgreementData(cycleId: string): Promise<AgreementData | null> {
  const supabase = await createClient();

  const { data: cycle, error: cycleErr } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee_id, employee:employees(name, position, empno, contract, role, org:orgs(name, parent_id)), financial_year:financial_years(label, start_year)"
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  const header = cycle as unknown as AgreementCycleRow | null;
  if (!header || !header.employee) return null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select(
      "kpa, name, unit_of_measure, baseline, annual_target, weight, poe, appraisal_ratings(quarter, target_value)"
    )
    .eq("appraisal_cycle_id", cycleId);
  if (kpiErr) throw kpiErr;

  const parentOrgId = header.employee.org?.parent_id;
  let municipalityName = header.employee.org?.name ?? "—";
  let municipalityOrgId: string | null = null;
  if (parentOrgId) {
    const { data: muni } = await supabase.from("orgs").select("id, name, kind").eq("id", parentOrgId).maybeSingle();
    const muniRow = muni as { id: string; name: string; kind: string } | null;
    if (muniRow?.kind === "municipality") {
      municipalityName = muniRow.name;
      municipalityOrgId = muniRow.id;
    }
  }

  const compQuery = supabase.from("competencies").select("name, group_name, driving_text");
  const { data: competencies, error: compErr } = await (municipalityOrgId
    ? compQuery.eq("org_id", municipalityOrgId)
    : compQuery
  )
    .order("group_name")
    .order("name");
  if (compErr) throw compErr;

  const policy = await getPolicyConfig(municipalityOrgId);

  const { data: canEditTemplateData } = municipalityOrgId
    ? await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: boolean | null }>
      )("has_org_access", { target_org_id: municipalityOrgId, required_permission: "manage_org_setup" })
    : { data: false };
  const canEditAgreementTemplate = Boolean(canEditTemplateData);

  const fyStartYear = header.financial_year?.start_year ?? null;
  const reviewSchedule: ReviewScheduleRow[] = [0, 1, 2, 3].map((qi) => ({
    quarter: qi + 1,
    reviewType: REVIEW_TYPE[qi],
    dueDate: policy.reviewDates[qi] || (fyStartYear != null ? defaultReviewDate(fyStartYear, qi as 0 | 1 | 2 | 3) : "—"),
  }));

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
  const signature = {
    employeeSignatory: agreementData?.employee_signatory ?? null,
    employerSignatory: agreementData?.employer_signatory ?? null,
    signPlace: agreementData?.sign_place ?? null,
    signDate: agreementData?.sign_date ?? null,
    status: agreementData?.status ?? ("draft" as const),
  };

  const kpiRows = (kpis ?? []) as unknown as AgreementKpiRow[];
  const agreementKpis: AgreementKpi[] = kpiRows
    .map((k) => {
      const byQuarter = (q: number) => (k.appraisal_ratings ?? []).find((r) => r.quarter === q)?.target_value ?? null;
      return {
        kpa: k.kpa,
        name: k.name,
        unitOfMeasure: k.unit_of_measure,
        baseline: k.baseline,
        annualTarget: k.annual_target,
        quarterlyTargets: [byQuarter(1), byQuarter(2), byQuarter(3), byQuarter(4)] as AgreementKpi["quarterlyTargets"],
        weight: k.weight,
        poe: k.poe,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalWeight = agreementKpis.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0);

  const kpaSummary: KpaSummaryRow[] = NATIONAL_KPAS.map((kpa) => {
    const matching = agreementKpis.filter((k) => (k.kpa ?? "").trim().toUpperCase() === kpa.code);
    return {
      code: kpa.code,
      name: kpa.name,
      count: matching.length,
      weightPct: Math.round(matching.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0) * 100) / 100,
    };
  });

  const compRows = (competencies ?? []) as unknown as CompetencyRow[];
  const agreementCompetencies: AgreementCompetency[] = compRows.map((c) => ({
    name: c.name,
    groupName: c.group_name,
    drivingText: c.driving_text,
  }));

  // The Municipal Manager is a Section 57 employee, assessed by the Mayor's
  // panel and employed (for agreement purposes) by the Mayor personally;
  // every other Section 56 manager is assessed by, and "employed" for
  // agreement purposes by, the Municipal Manager. Derived purely from
  // employee.role - never hardcoded - so this is correct for any employee
  // at any municipality without touching code.
  const isMM = header.employee.role === "MM";
  const agreementSection: AgreementData["agreementSection"] = isMM ? "Section 57" : "Section 56";
  const agreementTitle = isMM
    ? "Performance Agreement — Municipal Manager (section 57)"
    : "Performance Agreement — Manager directly accountable to the Municipal Manager (section 56)";
  const employerTitle = isMM ? policy.mayorTitle : "Municipal Manager";
  const employerName = isMM ? policy.mayorName : policy.mmName;

  return {
    cycleId: header.id,
    municipalityName,
    municipalityOrgId,
    canEditAgreementTemplate,
    fyLabel: header.financial_year?.label ?? "—",
    fyStartYear,
    reviewSchedule,
    employee: {
      name: header.employee.name,
      position: header.employee.position,
      empno: header.employee.empno,
      contract: header.employee.contract,
      orgName: header.employee.org?.name ?? "—",
      role: header.employee.role,
    },
    agreementSection,
    agreementTitle,
    employerTitle,
    employerName,
    kpis: agreementKpis,
    totalWeight,
    kpaSummary,
    competencies: agreementCompetencies,
    policy,
    generatedAt: new Date().toISOString(),
    signature,
  };
}
