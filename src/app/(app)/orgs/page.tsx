import Link from "next/link";
import { getOrgManageScopes, getOrgTree, getFlatOrgs, getDepartmentsWithStats } from "@/lib/data/orgs";
import { getPolicyConfig } from "@/lib/data/policy";
import { getActiveFinancialYear } from "@/lib/data/financial-years";
import { OrgTree } from "./OrgTree";
import { CreateOrgForm } from "./CreateOrgForm";
import { DepartmentsTable } from "./DepartmentsTable";
import { MunicipalityIdentityForm } from "./MunicipalityIdentityForm";

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ org }, scopes] = await Promise.all([searchParams, getOrgManageScopes()]);

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">Org Management</h1>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You don&apos;t have permission to manage orgs. This requires the &quot;manage_org_setup&quot;
          permission on a national, provincial, district, or municipal org - ask Friday Management
          Solutions or your Municipal Admin.
        </p>
      </div>
    );
  }

  const [tree, orgs] = await Promise.all([getOrgTree(), getFlatOrgs()]);
  const municipalities = orgs.filter((o) => o.kind === "municipality").sort((a, b) => a.name.localeCompare(b.name));
  const activeOrgId = municipalities.find((m) => m.id === org)?.id ?? municipalities[0]?.id ?? null;

  // Departments' live KPI(TL) counts are scoped to the selected municipality's
  // own financial-year list, not necessarily the signed-in user's globally
  // selected FY (getActiveFinancialYear resolves off the user's first
  // accessible municipality, which may differ from the one picked here) -
  // only trust its `selected` year when it actually resolved against this
  // same municipality.
  const activeFy = activeOrgId ? await getActiveFinancialYear() : null;
  const fyForThisMuni = activeFy && activeFy.muniOrgId === activeOrgId ? activeFy.selected : null;

  const [policy, departmentsForFy] = activeOrgId
    ? await Promise.all([
        getPolicyConfig(activeOrgId),
        getDepartmentsWithStats(activeOrgId, fyForThisMuni?.id ?? null),
      ])
    : [null, []];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">Org Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            The full government structure - national, provinces, districts, municipalities, and
            departments - nested exactly as they cascade for access and reporting. Add a new node
            below by picking its type and its parent; a metro municipality links straight to its
            province and skips the district level.
          </p>
        </div>
        {municipalities.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {municipalities.map((m) => (
              <Link
                key={m.id}
                href={`/orgs?org=${m.id}`}
                className={`stag ${m.id === activeOrgId ? "stag-blue" : "stag-pending"}`}
              >
                {m.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {activeOrgId && policy && (
        <>
          <div className="text-xs font-bold uppercase tracking-wide text-ink2">
            {municipalities.find((m) => m.id === activeOrgId)?.name}
          </div>
          <MunicipalityIdentityForm orgId={activeOrgId} mmName={policy.mmName} muniLogoUrl={policy.muniLogoUrl} />
          <DepartmentsTable
            municipalityOrgId={activeOrgId}
            departments={departmentsForFy}
            financialYearLabel={fyForThisMuni?.label ?? null}
          />
        </>
      )}

      <CreateOrgForm orgs={orgs} />

      <OrgTree roots={tree} />
    </div>
  );
}
