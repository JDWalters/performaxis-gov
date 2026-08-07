import { createClient } from "@/lib/supabase/server";
import { getMyAccessibleOrgs } from "@/lib/data/access";
import { getScorecardOverview, getAppraisalOverview } from "@/lib/data/dashboard";
import { getActiveScope } from "@/lib/data/scope";
import { OrgTree } from "@/components/OrgTree";

async function getStats(orgIds: string[], deptOrgIds: string[]) {
  const supabase = await createClient();

  const [{ count: employeeCount }, { count: municipalityCount }, { count: departmentCount }] =
    await Promise.all([
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .in("org_id", deptOrgIds.length ? deptOrgIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("orgs")
        .select("id", { count: "exact", head: true })
        .in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("kind", "municipality"),
      supabase
        .from("orgs")
        .select("id", { count: "exact", head: true })
        .in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("kind", "department"),
    ]);

  return {
    employeeCount: employeeCount ?? 0,
    municipalityCount: municipalityCount ?? 0,
    departmentCount: departmentCount ?? 0,
  };
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function ratingBadge(avg: number | null) {
  if (avg == null) return { className: "stag-pending", label: "Not yet rated" };
  if (avg >= 4) return { className: "stag-met", label: `${avg.toFixed(2)} avg` };
  if (avg >= 3) return { className: "stag-okk", label: `${avg.toFixed(2)} avg` };
  if (avg >= 2) return { className: "stag-almost", label: `${avg.toFixed(2)} avg` };
  return { className: "stag-missed", label: `${avg.toFixed(2)} avg` };
}

function completionBadge(percent: number) {
  if (percent >= 90) return "stag-met";
  if (percent >= 60) return "stag-okk";
  if (percent >= 30) return "stag-almost";
  return "stag-missed";
}

export default async function DashboardPage() {
  const [orgs, scope] = await Promise.all([getMyAccessibleOrgs(), getActiveScope()]);
  const scopedOrgs = scope ? orgs.filter((o) => scope.orgIds.has(o.id)) : orgs;
  const orgIds = scopedOrgs.map((o) => o.id);
  const deptOrgIds = scopedOrgs.filter((o) => o.kind === "department").map((o) => o.id);

  const [stats, scorecardOverview, appraisalOverview] = await Promise.all([
    getStats(orgIds, deptOrgIds),
    getScorecardOverview(scope?.orgIds ?? null),
    getAppraisalOverview(scope?.orgIds ?? null),
  ]);

  const sdbipCompletion = pct(scorecardOverview.totalQ4Captured, scorecardOverview.totalKpis);
  const appraisalCompletion = pct(
    appraisalOverview.totalRatingsCaptured,
    appraisalOverview.totalRatingsExpected
  );

  return (
    <div className="flex flex-col gap-6">
      {scope && (
        <div className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold-bg px-3 py-2 text-sm font-semibold text-ink">
          <span>
            Viewing scope: <span className="text-gold">{scope.org.name}</span> and everything under it
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <StatCard label="Municipalities in view" value={stats.municipalityCount} />
        <StatCard label="Departments in view" value={stats.departmentCount} />
        <StatCard label="Employees in view" value={stats.employeeCount} />
        <StatCard label="SDBIP KPIs tracked" value={scorecardOverview.totalKpis} />
        <StatCard
          label="Q4 reporting captured"
          value={`${sdbipCompletion}%`}
          hint={`${scorecardOverview.totalQ4Captured} of ${scorecardOverview.totalKpis} KPIs`}
        />
        <StatCard
          label="Appraisal ratings captured"
          value={`${appraisalCompletion}%`}
          hint={`${appraisalOverview.totalRatingsCaptured} of ${appraisalOverview.totalRatingsExpected} ratings`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink2">
            SDBIP — Service delivery scorecards
          </h2>
          <p className="mb-4 text-xs text-ink2">
            Quarter 4 reporting completion by department, computed live from captured results.
          </p>
          {scorecardOverview.depts.length === 0 ? (
            <p className="text-sm text-ink2">No scorecards in view yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {scorecardOverview.depts.map((d) => {
                const p = pct(d.q4Captured, d.kpiCount);
                return (
                  <div key={d.orgId}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{d.orgName}</span>
                      <span className={`stag ${completionBadge(p)}`}>
                        {d.q4Captured}/{d.kpiCount} KPIs · {p}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                      <div
                        className="h-full rounded-full bg-[var(--color-met)]"
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink2">
            EPAS — Performance agreements
          </h2>
          <p className="mb-4 text-xs text-ink2">
            Manager ratings captured per employee, across all quarters and KPIs on their
            agreement.
          </p>
          {appraisalOverview.employees.length === 0 ? (
            <p className="text-sm text-ink2">No appraisal cycles in view yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink2">
                    <th className="pb-2 font-extrabold">Employee</th>
                    <th className="pb-2 font-extrabold">Dept</th>
                    <th className="pb-2 font-extrabold">Ratings</th>
                    <th className="pb-2 font-extrabold">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisalOverview.employees.map((e) => {
                    const badge = ratingBadge(e.avgMgrRating);
                    return (
                      <tr key={e.employeeId} className="border-b border-line last:border-0">
                        <td className="py-2">
                          <div className="font-semibold text-ink">{e.name}</div>
                          <div className="text-xs text-ink2">{e.position}</div>
                        </td>
                        <td className="py-2 text-xs text-ink2">{e.orgName}</td>
                        <td className="py-2 font-mono text-xs text-ink2">
                          {e.ratingsCaptured}/{e.ratingsTotal}
                        </td>
                        <td className="py-2">
                          <span className={`stag ${badge.className}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink2">
          Organisations you can see
        </h2>
        <p className="mb-3 text-xs text-ink2">
          Click any row - national, provincial, district, municipality, or department - to scope every
          number above to just that branch of the hierarchy.
        </p>
        <OrgTree orgs={orgs} activeScopeOrgId={scope?.org.id ?? null} returnTo="/dashboard" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="min-w-[170px] flex-1 rounded-xl border border-line bg-white p-5">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink2">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink2">{hint}</div>}
    </div>
  );
}
