import { createClient } from "@/lib/supabase/server";
import type { KpiCalc, AppraisalKpi } from "@/lib/data/appraisals-shared";
import { needsReview } from "@/lib/data/kpi-calc-shared";
import {
  finalRating,
  weightedScore,
  simpleScore,
  overallScore,
  bandOf,
  percentOfStandard,
  bonusEligibility,
  kpiWeights,
  type ScoreBand,
  type BonusEligibility,
  type PartialScore,
} from "@/lib/data/appraisal-scoring";
import { getPolicyConfig, resolveMunicipalityOrgId } from "@/lib/data/policy";
import { getCompetencies } from "@/lib/data/competencies";

export type { KpiCalc, AppraisalKpi } from "@/lib/data/appraisals-shared";
export { friendlyAppraisalActual } from "@/lib/data/appraisals-shared";

export type AppraisalListItem = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  fyLabel: string;
  kpiCount: number;
  needsReviewCount: number;
};

type AppraisalListRow = {
  id: string;
  employee: { name: string; position: string | null; org: { name: string } | null } | null;
  financial_year: { label: string } | null;
  appraisal_kpis: {
    id: string;
    calc_config: { calc?: KpiCalc } | null;
    appraisal_ratings: { actual: string | null }[];
  }[];
};

/** Every appraisal cycle the signed-in user can see (RLS-scoped via has_employee_access). */
export async function getAppraisalsList(): Promise<AppraisalListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee:employees(name, position, org:orgs(name)), financial_year:financial_years(label), appraisal_kpis(id, calc_config, appraisal_ratings(actual))"
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as AppraisalListRow[];

  return rows
    .filter((r) => r.employee)
    .map((r) => {
      const kpis = r.appraisal_kpis ?? [];
      const needsReviewCount = kpis.reduce(
        (n, k) =>
          n + (k.appraisal_ratings ?? []).filter((rt) => needsReview(rt.actual, k.calc_config?.calc ?? null)).length,
        0
      );
      return {
        cycleId: r.id,
        employeeName: r.employee!.name,
        position: r.employee!.position,
        orgName: r.employee!.org?.name ?? "—",
        fyLabel: r.financial_year?.label ?? "—",
        kpiCount: kpis.length,
        needsReviewCount,
      };
    })
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
  /** True only via org-level capture_appraisal_ratings (a real manager/admin) - the reference's canManagerRate(), gates the Manager and Panel rating columns. */
  canManagerRate: boolean;
  /** canManagerRate, OR the signed-in user holds an employee_only-scoped membership tied to this exact employee - the reference's canSelfAssess(). Gates the Self rating column. */
  canSelfAssess: boolean;
  kpis: AppraisalKpi[];
  /** Quarters (1-4) with at least one legacy value that needs re-capturing - drives a dot on the quarter tabs. */
  quartersNeedingReview: number[];
  assessment: AssessmentSummary;
  competencies: CompetencyAssessment[];
  meta: AssessmentMeta;
};

export type CompetencyAssessment = {
  id: string;
  name: string;
  groupName: string | null;
  selfRating: number | null;
  mgrRating: number | null;
  panelRating: number | null;
  comment: string | null;
};

export type AssessmentMeta = {
  assessmentDate: string | null;
  assessmentType: string | null;
  panelMembers: string | null;
  employerComments: string | null;
  employeeComments: string | null;
  employeeSignature: string | null;
  chairSignature: string | null;
};

const BLANK_META: AssessmentMeta = {
  assessmentDate: null,
  assessmentType: null,
  panelMembers: null,
  employerComments: null,
  employeeComments: null,
  employeeSignature: null,
  chairSignature: null,
};

export type AssessmentSummary = {
  kpa: PartialScore & { weightPct: number };
  competencies: PartialScore & { weightPct: number };
  overall: {
    score: number | null;
    band: ScoreBand | null;
    percentOfStandard: number | null;
    bonus: BonusEligibility;
  };
};

type CompetencyRatingRow = {
  competency_id: string;
  self_rating: number | null;
  mgr_rating: number | null;
  panel_rating: number | null;
  comment: string | null;
  competency: { name: string; group_name: string | null } | null;
};

type AssessmentMetaRow = {
  assessment_date: string | null;
  assessment_type: string | null;
  panel_members: string | null;
  employer_comments: string | null;
  employee_comments: string | null;
  employee_signature: string | null;
  chair_signature: string | null;
};

type AppraisalHeaderRow = {
  id: string;
  employee_id: string;
  employee: { name: string; position: string | null; org: { id: string; name: string } | null } | null;
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
      "id, employee_id, employee:employees(name, position, org:orgs(id, name)), financial_year:financial_years(label)"
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  const header = cycle as unknown as AppraisalHeaderRow | null;
  if (!header || !header.employee) return null;

  const municipalityOrgId = header.employee.org ? await resolveMunicipalityOrgId(header.employee.org.id) : null;

  const { data: kpis, error: kpiErr } = await supabase
    .from("appraisal_kpis")
    .select(
      "id, name, kpa, unit_of_measure, weight, baseline, annual_target, poe, calc_config, appraisal_ratings(quarter, actual, inputs, target_value, na, evidence_url, comment, corrective_action, self_rating, mgr_rating, panel_rating)"
    )
    .eq("appraisal_cycle_id", cycleId);
  if (kpiErr) throw kpiErr;

  const { data: compRatings, error: compErr } = await supabase
    .from("appraisal_competency_ratings")
    .select("competency_id, self_rating, mgr_rating, panel_rating, comment, competency:competencies(name, group_name)")
    .eq("appraisal_cycle_id", cycleId)
    .eq("quarter", quarter);
  if (compErr) throw compErr;

  const { data: metaRow, error: metaErr } = await supabase
    .from("appraisal_assessment_meta")
    .select(
      "assessment_date, assessment_type, panel_members, employer_comments, employee_comments, employee_signature, chair_signature"
    )
    .eq("appraisal_cycle_id", cycleId)
    .eq("quarter", quarter)
    .maybeSingle();
  if (metaErr) throw metaErr;

  const policy = await getPolicyConfig(municipalityOrgId);

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

  // canManagerRate checks org-level access only (has_org_access), excluding
  // an employee_only self-scoped membership - matches the reference's
  // canManagerRate() = isAdmin(), strictly stronger than "can capture at
  // all" (has_employee_access, used for canCapture above, also admits a
  // self-scoped employee acting on their own record).
  const { data: canManageData } = header.employee.org
    ? await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: boolean | null }>
      )("has_org_access", {
        target_org_id: header.employee.org.id,
        required_permission: "capture_appraisal_ratings",
      })
    : { data: false };
  const canManagerRate = Boolean(canManageData);

  // canSelfAssess = canManagerRate OR the signed-in user holds a direct
  // membership tied to this exact employee (the employee's own self-service
  // account) - matches the reference's canSelfAssess() = isAdmin() ||
  // (isEmployee() && me.eid===eid). RLS on memberships only ever returns the
  // caller's own row (or every row if they already have manage_users, in
  // which case canManagerRate is already true anyway), so any row coming
  // back here for this employee_id reliably means "this is me".
  const { data: selfMembershipData } = await supabase
    .from("memberships")
    .select("id")
    .eq("employee_id", header.employee_id)
    .limit(1);
  const canSelfAssess = canManagerRate || Boolean((selfMembershipData ?? []).length);

  const kpiRows = (kpis ?? []) as unknown as AppraisalKpiRow[];

  const quartersNeedingReview = [...new Set(
    kpiRows.flatMap((k) =>
      (k.appraisal_ratings ?? [])
        .filter((r) => needsReview(r.actual, k.calc_config?.calc ?? null))
        .map((r) => r.quarter)
    )
  )].sort((a, b) => a - b);

  const KPA_WEIGHT = policy.kpaWeight / 100;
  const COMP_WEIGHT = policy.competencyWeight / 100;

  const kpaItems = kpiRows
    .map((k) => {
      const result = (k.appraisal_ratings ?? []).find((r) => r.quarter === quarter);
      if (result?.na) return null; // N/A-flagged KPIs drop out of the applicable pool entirely
      const rating = result
        ? finalRating(result.self_rating, result.mgr_rating, result.panel_rating)
        : null;
      const weight = k.weight ? Number(k.weight) : 0;
      return { rating, weight };
    })
    .filter((i): i is { rating: number | null; weight: number } => i !== null);
  const kpaPartial = weightedScore(kpaItems);

  const compRows = (compRatings ?? []) as unknown as CompetencyRatingRow[];
  const compPartial = simpleScore(
    compRows.map((c) => finalRating(c.self_rating, c.mgr_rating, c.panel_rating))
  );

  // Effective (rebased-to-100%-among-applicable) weight per KPI, purely for
  // display on the Assessments/Ratings screen - the reference's kpiWeights().
  const effWeights = kpiWeights(
    kpiRows.map((k) => {
      const result = (k.appraisal_ratings ?? []).find((r) => r.quarter === quarter);
      return { id: k.id, weight: k.weight ? Number(k.weight) : 0, na: Boolean(result?.na) };
    })
  );

  // The full competency framework for this municipality, left-joined with
  // whatever ratings/comments have already been captured this quarter - so
  // every competency shows up ready to rate, not just ones already touched.
  const compFramework = municipalityOrgId ? await getCompetencies(municipalityOrgId) : [];
  const competencies: CompetencyAssessment[] = compFramework.map((c) => {
    const r = compRows.find((row) => row.competency_id === c.id);
    return {
      id: c.id,
      name: c.name,
      groupName: c.groupName,
      selfRating: r?.self_rating ?? null,
      mgrRating: r?.mgr_rating ?? null,
      panelRating: r?.panel_rating ?? null,
      comment: r?.comment ?? null,
    };
  });

  const metaData = metaRow as unknown as AssessmentMetaRow | null;
  const meta: AssessmentMeta = metaData
    ? {
        assessmentDate: metaData.assessment_date,
        assessmentType: metaData.assessment_type,
        panelMembers: metaData.panel_members,
        employerComments: metaData.employer_comments,
        employeeComments: metaData.employee_comments,
        employeeSignature: metaData.employee_signature,
        chairSignature: metaData.chair_signature,
      }
    : BLANK_META;

  const overall = overallScore(kpaPartial.score, compPartial.score, KPA_WEIGHT, COMP_WEIGHT);

  const assessment: AssessmentSummary = {
    kpa: { ...kpaPartial, weightPct: KPA_WEIGHT * 100 },
    competencies: { ...compPartial, weightPct: COMP_WEIGHT * 100 },
    overall: {
      score: overall,
      band: bandOf(overall, policy.ratingScale),
      percentOfStandard: percentOfStandard(overall),
      bonus: bonusEligibility(overall, policy.bonusBands),
    },
  };

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
        effectiveWeightPct: effWeights.get(k.id) ?? 0,
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
    canManagerRate,
    canSelfAssess,
    kpis: rows,
    quartersNeedingReview,
    assessment,
    competencies,
    meta,
  };
}
