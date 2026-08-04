import { createClient } from "@/lib/supabase/server";

/** A value counts as "captured" if it's a real reported figure, not blank or N/A. */
function isCaptured(actual: string | null | undefined) {
  return !!actual && actual.trim() !== "" && actual.trim().toUpperCase() !== "N/A";
}

export type DeptScorecardSummary = {
  orgId: string;
  orgName: string;
  kpiCount: number;
  q4Captured: number;
};

export type ScorecardOverview = {
  depts: DeptScorecardSummary[];
  totalKpis: number;
  totalQ4Captured: number;
};

type ScorecardRow = {
  id: string;
  org: { id: string; name: string } | null;
  scorecard_kpis: {
    id: string;
    kpi_results: { quarter: number; actual: string | null }[];
  }[];
};

/**
 * Live per-department SDBIP completion rollup: for every department scorecard the
 * signed-in user can see (RLS-scoped via has_org_access), how many KPIs have a
 * genuine Q4 result captured. No snapshot table - computed on every request per the
 * schema design (small dataset, real-time rollups).
 */
export async function getScorecardOverview(): Promise<ScorecardOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scorecards")
    .select("id, org:orgs(id, name), scorecard_kpis(id, kpi_results(quarter, actual))");
  if (error) throw error;

  const rows = (data ?? []) as unknown as ScorecardRow[];

  const depts: DeptScorecardSummary[] = rows
    .filter((r) => r.org)
    .map((r) => {
      const kpis = r.scorecard_kpis ?? [];
      const q4Captured = kpis.filter((k) =>
        (k.kpi_results ?? []).some((res) => res.quarter === 4 && isCaptured(res.actual))
      ).length;
      return {
        orgId: r.org!.id,
        orgName: r.org!.name,
        kpiCount: kpis.length,
        q4Captured,
      };
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName));

  const totalKpis = depts.reduce((sum, d) => sum + d.kpiCount, 0);
  const totalQ4Captured = depts.reduce((sum, d) => sum + d.q4Captured, 0);

  return { depts, totalKpis, totalQ4Captured };
}

export type EmployeeAppraisalSummary = {
  employeeId: string;
  name: string;
  position: string | null;
  orgName: string;
  kpiCount: number;
  ratingsCaptured: number;
  ratingsTotal: number;
  avgMgrRating: number | null;
};

export type AppraisalOverview = {
  employees: EmployeeAppraisalSummary[];
  cycleCount: number;
  totalRatingsCaptured: number;
  totalRatingsExpected: number;
  avgMgrRating: number | null;
};

type AppraisalCycleRow = {
  id: string;
  employee: {
    id: string;
    name: string;
    position: string | null;
    org: { name: string } | null;
  } | null;
  appraisal_kpis: {
    id: string;
    appraisal_ratings: { quarter: number; mgr_rating: number | null }[];
  }[];
};

/**
 * Live per-employee EPAS appraisal rollup: for every appraisal cycle the signed-in
 * user can see (RLS-scoped via has_employee_access), how many quarterly manager
 * ratings have been captured out of how many are expected, and the average manager
 * rating so far.
 */
export async function getAppraisalOverview(): Promise<AppraisalOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select(
      "id, employee:employees(id, name, position, org:orgs(name)), appraisal_kpis(id, appraisal_ratings(quarter, mgr_rating))"
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as AppraisalCycleRow[];

  const employees: EmployeeAppraisalSummary[] = rows
    .filter((r) => r.employee)
    .map((r) => {
      const kpis = r.appraisal_kpis ?? [];
      const allRatings = kpis.flatMap((k) => k.appraisal_ratings ?? []);
      const rated = allRatings.filter((rt) => rt.mgr_rating != null);
      const avg =
        rated.length > 0
          ? rated.reduce((sum, rt) => sum + (rt.mgr_rating ?? 0), 0) / rated.length
          : null;
      return {
        employeeId: r.employee!.id,
        name: r.employee!.name,
        position: r.employee!.position,
        orgName: r.employee!.org?.name ?? "",
        kpiCount: kpis.length,
        ratingsCaptured: rated.length,
        ratingsTotal: allRatings.length,
        avgMgrRating: avg,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalRatingsCaptured = employees.reduce((s, e) => s + e.ratingsCaptured, 0);
  const totalRatingsExpected = employees.reduce((s, e) => s + e.ratingsTotal, 0);
  const ratedEmployees = employees.filter((e) => e.avgMgrRating != null);
  const avgMgrRating =
    ratedEmployees.length > 0
      ? ratedEmployees.reduce((s, e) => s + (e.avgMgrRating ?? 0), 0) / ratedEmployees.length
      : null;

  return {
    employees,
    cycleCount: rows.length,
    totalRatingsCaptured,
    totalRatingsExpected,
    avgMgrRating,
  };
}
