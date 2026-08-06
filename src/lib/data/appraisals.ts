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
import { getPolicyConfig, resolveMunicipalityOrgId, defaultReviewDate, REVIEW_TYPE } from "@/lib/data/policy";
import { getCompetencies } from "@/lib/data/competencies";
import { getAnnexureData } from "@/lib/data/annexure";
import type { EmployeeRole } from "@/lib/data/employees-shared";
import { kpaRank } from "@/lib/data/kpa-shared";

export type { KpiCalc, AppraisalKpi } from "@/lib/data/appraisals-shared";
export { friendlyAppraisalActual } from "@/lib/data/appraisals-shared";

export type AppraisalListItem = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  role: EmployeeRole;
  orgId: string | null;
  orgName: string;
  fyLabel: string;
  kpiCount: number;
  needsReviewCount: number;
};

type AppraisalListRow = {
  id: string;
  employee: {
    name: string;
    position: string | null;
    role: EmployeeRole;
    org: { id: string; name: string } | null;
  } | null;
  financial_year: { label: string } | null;
  appraisal_kpis: {
    id: string;
    calc_config: { calc?: KpiCalc } | null;
    appraisal_ratings: { actual: string | null }[];
  }[];
};

/**
 * Every appraisal cycle the signed-in user can see (RLS-scoped via
 * has_employee_access). `scopedOrgIds`, when given, further narrows this to
 * the signed-in user's active viewing scope (see src/lib/data/scope.ts) - a
 * display filter, not a security one.
 *
 * Sorted to flow with the actual reporting hierarchy - the Municipal
 * Manager first, then each Director by department - rather than plain
 * alphabetical, which buries the MM under "Office of the Municipal
 * Manager" (O) behind every department starting with an earlier letter.
 */
export async function getAppraisalsList(scopedOrgIds?: Set<string> | null): Promise<AppraisalListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee:employees(name, position, role, org:orgs(id, name)), financial_year:financial_years(label), appraisal_kpis(id, calc_config, appraisal_ratings(actual))"
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as AppraisalListRow[];

  return rows
    .filter((r) => r.employee && (!scopedOrgIds || (r.employee.org && scopedOrgIds.has(r.employee.org.id))))
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
        role: r.employee!.role,
        orgId: r.employee!.org?.id ?? null,
        orgName: r.employee!.org?.name ?? "—",
        fyLabel: r.financial_year?.label ?? "—",
        kpiCount: kpis.length,
        needsReviewCount,
      };
    })
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "MM" ? -1 : b.role === "MM" ? 1 : 0;
      return a.orgName.localeCompare(b.orgName) || a.employeeName.localeCompare(b.employeeName);
    });
}

export type AppraisalDetail = {
  cycleId: string;
  employeeId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  fyLabel: string;
  quarter: number;
  /** e.g. "Q1 (Jul–Sep)" - the reference's QL[q]. */
  quarterLabel: string;
  /** e.g. "informal assessment by MM" / "Mid-year Panel Assessment" - the reference's REVIEW_TYPE[q]. */
  reviewType: string;
  /** e.g. "December 2025" - the org's configured review date, falling back to the regulation-derived default. */
  reviewDueDate: string;
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

// The reference's QL - short quarter label with its month range, used on the
// Assessments screen header (distinct from the print agreement's full
// "July – September" wording, which reads better in legal prose).
const QUARTER_LABEL = ["Q1 (Jul–Sep)", "Q2 (Oct–Dec)", "Q3 (Jan–Mar)", "Q4 (Apr–Jun)"];

export type CompetencyAssessment = {
  id: string;
  name: string;
  groupName: string | null;
  drivingText: string | null;
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
  financial_year: { label: string; start_year: number } | null;
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
  created_at: string;
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
      "id, employee_id, employee:employees(name, position, org:orgs(id, name)), financial_year:financial_years(label, start_year)"
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
      "id, name, kpa, unit_of_measure, weight, baseline, annual_target, poe, calc_config, created_at, appraisal_ratings(quarter, actual, inputs, target_value, na, evidence_url, comment, corrective_action, self_rating, mgr_rating, panel_rating)"
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
      drivingText: c.drivingText,
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

  const rows: AppraisalKpi[] = [...kpiRows]
    // Grouped by KPA in the regulatory order (kpaRank), then by capture
    // order within each KPA - matches the reference tool's KPI ordering
    // (Capture results, Assessment ratings, the printed agreement), which
    // is never alphabetical by indicator name.
    .sort((a, b) => {
      const ra = kpaRank(a.kpa);
      const rb = kpaRank(b.kpa);
      if (ra !== rb) return ra - rb;
      return a.created_at.localeCompare(b.created_at);
    })
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
    });

  const fyStartYear = header.financial_year?.start_year ?? null;
  const reviewType = REVIEW_TYPE[quarter - 1] ?? "";
  const reviewDueDate =
    policy.reviewDates[quarter - 1] ||
    (fyStartYear != null ? defaultReviewDate(fyStartYear, (quarter - 1) as 0 | 1 | 2 | 3) : "—");

  return {
    cycleId: header.id,
    employeeId: header.employee_id,
    employeeName: header.employee.name,
    position: header.employee.position,
    orgName: header.employee.org?.name ?? "—",
    fyLabel: header.financial_year?.label ?? "—",
    quarter,
    quarterLabel: QUARTER_LABEL[quarter - 1] ?? `Q${quarter}`,
    reviewType,
    reviewDueDate,
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

export type AnnualQuarterSummary = {
  quarter: number;
  kpaScore: number | null;
  competencyScore: number | null;
  overallScore: number | null;
  band: ScoreBand | null;
};

export type AnnualSummary = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  fyLabel: string;
  quarters: AnnualQuarterSummary[];
  /** Q4's score if assessed, else the last quarter that was - the reference's buildAnnual() year-end figure. */
  yearEndScore: number | null;
  yearEndBand: ScoreBand | null;
  averageScore: number | null;
  bonus: BonusEligibility;
  kpis: AppraisalKpi[];
};

/**
 * All four quarters of one employee's cycle rolled up into a single
 * year-end view - the reference's buildAnnual(). Reuses getAppraisalDetail()
 * once per quarter rather than duplicating its scoring logic; this is a
 * report page, not a hot path, so four sequential fetches are an acceptable
 * trade for not maintaining two copies of the same scoring rules.
 */
export async function getAnnualSummary(cycleId: string): Promise<AnnualSummary | null> {
  const details = await Promise.all([1, 2, 3, 4].map((q) => getAppraisalDetail(cycleId, q)));
  const first = details[0];
  if (!first) return null;

  const quarters: AnnualQuarterSummary[] = details.map((d, i) => ({
    quarter: i + 1,
    kpaScore: d?.assessment.kpa.score ?? null,
    competencyScore: d?.assessment.competencies.score ?? null,
    overallScore: d?.assessment.overall.score ?? null,
    band: d?.assessment.overall.band ?? null,
  }));

  const scored = quarters.filter((q) => q.overallScore != null);
  const q4 = quarters[3];
  const yearEndScore = q4.overallScore ?? (scored.length ? scored[scored.length - 1].overallScore : null);
  const averageScore = scored.length
    ? scored.reduce((sum, q) => sum + (q.overallScore ?? 0), 0) / scored.length
    : null;

  const supabase = await createClient();
  const { data: empOrgRow } = await supabase
    .from("employees")
    .select("org_id")
    .eq("id", first.employeeId)
    .maybeSingle();
  const employeeOrgId = (empOrgRow as unknown as { org_id: string } | null)?.org_id ?? null;
  const municipalityOrgId = employeeOrgId ? await resolveMunicipalityOrgId(employeeOrgId) : null;
  const policy = await getPolicyConfig(municipalityOrgId);

  return {
    cycleId: first.cycleId,
    employeeName: first.employeeName,
    position: first.position,
    orgName: first.orgName,
    fyLabel: first.fyLabel,
    quarters,
    yearEndScore,
    yearEndBand: bandOf(yearEndScore, policy.ratingScale),
    averageScore,
    bonus: bonusEligibility(yearEndScore, policy.bonusBands),
    kpis: first.kpis,
  };
}

export type OrgSummaryRow = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  orgName: string;
  kpiCount: number;
  quarters: AnnualQuarterSummary[];
};

export type OrgSummary = {
  fyLabel: string;
  quarter: number;
  rows: OrgSummaryRow[];
};

type FinancialYearRow = { id: string; label: string; start_year: number };

/**
 * Every accessible employee's score for one quarter, for the organisational
 * summary report - the reference's buildOrg(). RLS on appraisal_cycles
 * already scopes this to whatever the signed-in user can see (their own
 * department and below), exactly like Performance Progress does, so no
 * separate access check is needed here. `scopedOrgIds`, when given, further
 * narrows this to the signed-in user's active viewing scope (see
 * src/lib/data/scope.ts) - a display filter, not a security one.
 */
export async function getOrgSummary(
  quarter: number,
  financialYearId?: string,
  scopedOrgIds?: Set<string> | null
): Promise<OrgSummary | null> {
  const supabase = await createClient();

  let fyId = financialYearId ?? null;
  let fyLabel = "—";
  if (!fyId) {
    const { data: fyRow } = await supabase
      .from("financial_years")
      .select("id, label, start_year")
      .eq("is_current", true)
      .order("start_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fy = fyRow as unknown as FinancialYearRow | null;
    if (fy) {
      fyId = fy.id;
      fyLabel = fy.label;
    }
  } else {
    const { data: fyRow } = await supabase
      .from("financial_years")
      .select("id, label, start_year")
      .eq("id", fyId)
      .maybeSingle();
    fyLabel = (fyRow as unknown as FinancialYearRow | null)?.label ?? "—";
  }
  if (!fyId) return null;

  const { data: cycles, error: cyclesErr } = await supabase
    .from("appraisal_cycles")
    .select("id, employee:employees(name, position, org:orgs(id, name))")
    .eq("financial_year_id", fyId);
  if (cyclesErr) throw cyclesErr;

  type CycleRow = {
    id: string;
    employee: { name: string; position: string | null; org: { id: string; name: string } | null } | null;
  };
  const cycleRows = (cycles ?? []) as unknown as CycleRow[];

  const rows: OrgSummaryRow[] = [];
  for (const c of cycleRows) {
    if (!c.employee) continue;
    if (scopedOrgIds && (!c.employee.org || !scopedOrgIds.has(c.employee.org.id))) continue;
    const detail = await getAppraisalDetail(c.id, quarter);
    if (!detail) continue;
    rows.push({
      cycleId: c.id,
      employeeName: c.employee.name,
      position: c.employee.position,
      orgName: c.employee.org?.name ?? "—",
      kpiCount: detail.kpis.length,
      quarters: [
        {
          quarter,
          kpaScore: detail.assessment.kpa.score,
          competencyScore: detail.assessment.competencies.score,
          overallScore: detail.assessment.overall.score,
          band: detail.assessment.overall.band,
        },
      ],
    });
  }

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return { fyLabel, quarter, rows };
}

/**
 * A CSV of every accessible employee's indicators, quarterly targets, final
 * ratings and N/A flags - the reference's exportCsv(). RLS on
 * appraisal_cycles already scopes this to whatever cycles the signed-in
 * user can see. Returned as a plain string[][] (header row first) so the
 * route handler that turns this into a download stays trivial.
 */
export async function getCsvExportRows(): Promise<string[][]> {
  const cycles = await getAppraisalsList();

  const header = [
    "Employee",
    "Position",
    "Department",
    "Financial year",
    "#",
    "KPA",
    "Indicator",
    "Unit",
    "Baseline",
    "Annual target",
    "Q1 target",
    "Q2 target",
    "Q3 target",
    "Q4 target",
    "Weight %",
    "Q1 final",
    "Q2 final",
    "Q3 final",
    "Q4 final",
    "Q1 N/A",
    "Q2 N/A",
    "Q3 N/A",
    "Q4 N/A",
    "Evidence",
  ];
  const rows: string[][] = [header];

  for (const c of cycles) {
    const [annexure, d1, d2, d3, d4] = await Promise.all([
      getAnnexureData(c.cycleId),
      getAppraisalDetail(c.cycleId, 1),
      getAppraisalDetail(c.cycleId, 2),
      getAppraisalDetail(c.cycleId, 3),
      getAppraisalDetail(c.cycleId, 4),
    ]);
    if (!annexure) continue;
    const details = [d1, d2, d3, d4];

    annexure.kpis.forEach((k, i) => {
      const perQuarter = details.map((d) => d?.kpis.find((x) => x.id === k.id) ?? null);
      const finals = perQuarter.map((k2) =>
        k2 ? String(finalRating(k2.result?.selfRating ?? null, k2.result?.mgrRating ?? null, k2.result?.panelRating ?? null) ?? "") : ""
      );
      const nas = perQuarter.map((k2) => (k2?.result?.na ? "Yes" : ""));

      rows.push([
        c.employeeName,
        c.position ?? "",
        c.orgName,
        c.fyLabel,
        String(i + 1),
        k.kpa ?? "",
        k.name,
        k.unitOfMeasure ?? "",
        k.baseline ?? "",
        k.annualTarget ?? "",
        k.quarterlyTargets[0] ?? "",
        k.quarterlyTargets[1] ?? "",
        k.quarterlyTargets[2] ?? "",
        k.quarterlyTargets[3] ?? "",
        String(k.weight ?? ""),
        ...finals,
        ...nas,
        k.poe ?? "",
      ]);
    });
  }

  return rows;
}
