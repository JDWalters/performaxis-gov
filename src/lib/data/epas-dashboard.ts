import { createClient } from "@/lib/supabase/server";
import {
  finalRating,
  weightedScore,
  simpleScore,
  overallScore,
  bandOf,
  bandKey,
  percentOfStandard,
  type ScoreBand,
  type EpasBandKey,
} from "@/lib/data/appraisal-scoring";
import { getPolicyConfig, resolveMunicipalityOrgId, REVIEW_TYPE, defaultReviewDate } from "@/lib/data/policy";
import { NATIONAL_KPAS } from "@/lib/data/kpa-shared";
import type { EmployeeRole } from "@/lib/data/employees-shared";

/**
 * The EPAS performance dashboard - a direct port of the reference tool's
 * pageDash()/dashBody() (index.html), not a reuse of SDBIP's per-KPI status
 * system. EPAS scores an *employee*, not a KPI: every row below is that
 * employee's overall weighted score (KPA component + competency component,
 * see appraisal-scoring.ts's overallScore()) for one quarter, banded on the
 * same 5-tier scale used everywhere else in EPAS (Assessments screen,
 * printed agreement, Reports). Unlike the SDBIP dashboard, there is no
 * mid-year/annual period or per-department rollup here - the reference
 * dashboard is just "every accessible employee, this quarter", matching
 * pageDash()'s `list = isAdmin() ? S.emps : S.emps.filter(own)`.
 */

export type EpasTally = Record<EpasBandKey, number>;
export function emptyEpasTally(): EpasTally {
  return { blue: 0, met: 0, okk: 0, almost: 0, missed: 0, pending: 0 };
}

export type EpasEmployeeRow = {
  cycleId: string;
  employeeName: string;
  position: string | null;
  role: EmployeeRole;
  orgName: string;
  kpiCount: number;
  weightPct: number;
  weightOk: boolean;
  kpaScore: number | null;
  compScore: number | null;
  overallScore: number | null;
  resultPct: number | null;
  band: ScoreBand | null;
  quarterScores: (number | null)[];
};

export type EpasKpaRow = { code: string; name: string; avgScore: number | null };

export type EpasDashboardData = {
  quarter: number;
  quarterLabel: string;
  reviewType: string;
  reviewDueLabel: string;
  employeeCount: number;
  avgScore: number | null;
  avgBand: ScoreBand | null;
  avgPercentOfStandard: number | null;
  tally: EpasTally;
  kpaWeightPct: number;
  compWeightPct: number;
  employees: EpasEmployeeRow[];
  kpas: EpasKpaRow[];
};

const QUARTER_LABEL = ["Q1 (Jul–Sep)", "Q2 (Oct–Dec)", "Q3 (Jan–Mar)", "Q4 (Apr–Jun)"];

type CycleRow = {
  id: string;
  employee: {
    id: string;
    name: string;
    position: string | null;
    role: EmployeeRole;
    org: { id: string; name: string } | null;
  } | null;
};

type KpiRow = {
  id: string;
  kpa: string | null;
  weight: string | null;
  appraisal_cycle_id: string;
  appraisal_ratings: {
    quarter: number;
    self_rating: number | null;
    mgr_rating: number | null;
    panel_rating: number | null;
    na: boolean | null;
  }[];
};

type CompRow = {
  appraisal_cycle_id: string;
  quarter: number;
  self_rating: number | null;
  mgr_rating: number | null;
  panel_rating: number | null;
};

export async function getEpasDashboard(
  quarter: number,
  financialYearId?: string | null,
  scopedOrgIds?: Set<string> | null
): Promise<EpasDashboardData> {
  const supabase = await createClient();

  let cyclesQuery = supabase
    .from("appraisal_cycles")
    .select("id, employee:employees(id, name, position, role, org:orgs(id, name))");
  if (financialYearId) cyclesQuery = cyclesQuery.eq("financial_year_id", financialYearId);
  const { data: cycleData, error: cErr } = await cyclesQuery;
  if (cErr) throw cErr;

  const cycles = ((cycleData ?? []) as unknown as CycleRow[]).filter(
    (c) => c.employee && (!scopedOrgIds || (c.employee.org && scopedOrgIds.has(c.employee.org.id)))
  );
  const cycleIds = cycles.map((c) => c.id);

  let kpiRows: KpiRow[] = [];
  let compRows: CompRow[] = [];
  if (cycleIds.length > 0) {
    const [{ data: kpiData, error: kpiErr }, { data: compData, error: compErr }] = await Promise.all([
      supabase
        .from("appraisal_kpis")
        .select(
          "id, kpa, weight, appraisal_cycle_id, appraisal_ratings(quarter, self_rating, mgr_rating, panel_rating, na)"
        )
        .in("appraisal_cycle_id", cycleIds),
      supabase
        .from("appraisal_competency_ratings")
        .select("appraisal_cycle_id, quarter, self_rating, mgr_rating, panel_rating")
        .in("appraisal_cycle_id", cycleIds),
    ]);
    if (kpiErr) throw kpiErr;
    if (compErr) throw compErr;
    kpiRows = (kpiData ?? []) as unknown as KpiRow[];
    compRows = (compData ?? []) as unknown as CompRow[];
  }

  // Policy config (KPA/competency weight split, rating-scale terminology) is
  // per-municipality - cache by municipality org id so a multi-department
  // (or, in principle, multi-municipality) view doesn't refetch per employee.
  const policyCache = new Map<string, Awaited<ReturnType<typeof getPolicyConfig>>>();
  async function policyFor(deptOrgId: string | null) {
    if (!deptOrgId) return getPolicyConfig(null);
    const muniId = await resolveMunicipalityOrgId(deptOrgId);
    const key = muniId ?? "__none__";
    if (!policyCache.has(key)) policyCache.set(key, await getPolicyConfig(muniId));
    return policyCache.get(key)!;
  }

  const employees: EpasEmployeeRow[] = [];
  // Per-KPA, per-employee weighted-average rating for the selected quarter -
  // collected here so the KPA breakdown below can average across employees
  // without a second pass over the raw rows.
  const kpaSamples = new Map<string, number[]>();
  for (const kpa of NATIONAL_KPAS) kpaSamples.set(kpa.code, []);

  for (const c of cycles) {
    const emp = c.employee!;
    const kpis = kpiRows.filter((k) => k.appraisal_cycle_id === c.id);
    const comps = compRows.filter((r) => r.appraisal_cycle_id === c.id);
    const policy = await policyFor(emp.org?.id ?? null);
    const kpaWeight = policy.kpaWeight / 100;
    const compWeight = policy.competencyWeight / 100;

    const weightPct = kpis.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0);

    const quarterScores: (number | null)[] = [];
    for (let q = 1; q <= 4; q++) {
      const kpaItems = kpis
        .map((k) => {
          const r = k.appraisal_ratings.find((rt) => rt.quarter === q);
          if (r?.na) return null;
          const rating = r ? finalRating(r.self_rating, r.mgr_rating, r.panel_rating) : null;
          return { rating, weight: k.weight ? Number(k.weight) : 0 };
        })
        .filter((i): i is { rating: number | null; weight: number } => i !== null);
      const kpaPartial = weightedScore(kpaItems);

      const compPartial = simpleScore(
        comps.filter((r) => r.quarter === q).map((r) => finalRating(r.self_rating, r.mgr_rating, r.panel_rating))
      );

      const overall = overallScore(kpaPartial.score, compPartial.score, kpaWeight, compWeight);
      quarterScores.push(overall);

      if (q === quarter) {
        employees.push({
          cycleId: c.id,
          employeeName: emp.name,
          position: emp.position,
          role: emp.role,
          orgName: emp.org?.name ?? "—",
          kpiCount: kpis.length,
          weightPct,
          weightOk: Math.abs(weightPct - 100) < 0.5,
          kpaScore: kpaPartial.score,
          compScore: compPartial.score,
          overallScore: overall,
          resultPct: overall == null ? null : (overall / 5) * 100,
          band: bandOf(overall, policy.ratingScale),
          // filled in below once all 4 quarters are computed
          quarterScores: [],
        });

        for (const kpa of NATIONAL_KPAS) {
          const items = kpis
            .filter((k) => (k.kpa || "").trim().toUpperCase() === kpa.code)
            .map((k) => {
              const r = k.appraisal_ratings.find((rt) => rt.quarter === q);
              if (r?.na) return null;
              const rating = r ? finalRating(r.self_rating, r.mgr_rating, r.panel_rating) : null;
              return { rating, weight: k.weight ? Number(k.weight) : 0 };
            })
            .filter((i): i is { rating: number | null; weight: number } => i !== null);
          const partial = weightedScore(items);
          if (partial.score != null) kpaSamples.get(kpa.code)!.push(partial.score);
        }
      }
    }
    employees[employees.length - 1].quarterScores = quarterScores;
  }

  employees.sort((a, b) => {
    if (a.role !== b.role) return a.role === "MM" ? -1 : b.role === "MM" ? 1 : 0;
    return a.orgName.localeCompare(b.orgName) || a.employeeName.localeCompare(b.employeeName);
  });

  const scored = employees.filter((e) => e.overallScore != null);
  const avgScore = scored.length
    ? scored.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / scored.length
    : null;

  const tally = emptyEpasTally();
  for (const e of employees) tally[bandKey(e.overallScore)]++;

  const kpas: EpasKpaRow[] = NATIONAL_KPAS.map((kpa) => {
    const samples = kpaSamples.get(kpa.code) ?? [];
    return {
      code: kpa.code,
      name: kpa.name,
      avgScore: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null,
    };
  });

  // Weighting hint + average band use the first municipality's policy found
  // in this view (in practice there is exactly one, per client) - falls back
  // to the regulation defaults if no cycles are in view yet.
  const firstPolicy = cycles.length ? await policyFor(cycles[0].employee?.org?.id ?? null) : await getPolicyConfig(null);

  let reviewDueLabel = "—";
  if (financialYearId) {
    const { data: fyRow } = await supabase
      .from("financial_years")
      .select("start_year")
      .eq("id", financialYearId)
      .maybeSingle();
    const startYear = (fyRow as unknown as { start_year: number } | null)?.start_year;
    if (startYear != null) reviewDueLabel = defaultReviewDate(startYear, (quarter - 1) as 0 | 1 | 2 | 3);
  }

  return {
    quarter,
    quarterLabel: QUARTER_LABEL[quarter - 1] ?? `Q${quarter}`,
    reviewType: REVIEW_TYPE[quarter - 1] ?? "Assessment",
    reviewDueLabel,
    employeeCount: employees.length,
    avgScore,
    avgBand: bandOf(avgScore, firstPolicy.ratingScale),
    avgPercentOfStandard: percentOfStandard(avgScore),
    tally,
    kpaWeightPct: firstPolicy.kpaWeight,
    compWeightPct: firstPolicy.competencyWeight,
    employees,
    kpas,
  };
}
