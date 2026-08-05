import { createClient } from "@/lib/supabase/server";
import { getPolicyConfig, type PolicyConfig } from "@/lib/data/policy";

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

export type AgreementData = {
  cycleId: string;
  municipalityName: string;
  fyLabel: string;
  fyStartYear: number | null;
  employee: {
    name: string;
    position: string | null;
    empno: string | null;
    contract: string | null;
    orgName: string;
  };
  kpis: AgreementKpi[];
  totalWeight: number;
  competencies: AgreementCompetency[];
  policy: PolicyConfig;
  generatedAt: string;
};

type AgreementCycleRow = {
  id: string;
  employee_id: string;
  employee: {
    name: string;
    position: string | null;
    empno: string | null;
    contract: string | null;
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
      "id, employee_id, employee:employees(name, position, empno, contract, org:orgs(name, parent_id)), financial_year:financial_years(label, start_year)"
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

  const orgId = header.employee.org?.parent_id;
  let municipalityName = header.employee.org?.name ?? "—";
  if (orgId) {
    const { data: muni } = await supabase.from("orgs").select("name, kind").eq("id", orgId).maybeSingle();
    const muniRow = muni as { name: string; kind: string } | null;
    if (muniRow?.kind === "municipality") municipalityName = muniRow.name;
  }

  const { data: competencies, error: compErr } = await supabase
    .from("competencies")
    .select("name, group_name, driving_text")
    .order("group_name")
    .order("name");
  if (compErr) throw compErr;

  const policy = await getPolicyConfig();

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

  const compRows = (competencies ?? []) as unknown as CompetencyRow[];
  const agreementCompetencies: AgreementCompetency[] = compRows.map((c) => ({
    name: c.name,
    groupName: c.group_name,
    drivingText: c.driving_text,
  }));

  return {
    cycleId: header.id,
    municipalityName,
    fyLabel: header.financial_year?.label ?? "—",
    fyStartYear: header.financial_year?.start_year ?? null,
    employee: {
      name: header.employee.name,
      position: header.employee.position,
      empno: header.employee.empno,
      contract: header.employee.contract,
      orgName: header.employee.org?.name ?? "—",
    },
    kpis: agreementKpis,
    totalWeight,
    competencies: agreementCompetencies,
    policy,
    generatedAt: new Date().toISOString(),
  };
}
