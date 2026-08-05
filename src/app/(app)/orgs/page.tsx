import { getOrgManageScopes, getOrgTree, getFlatOrgs } from "@/lib/data/orgs";
import { OrgTree } from "./OrgTree";
import { CreateOrgForm } from "./CreateOrgForm";

export default async function OrgsPage() {
  const scopes = await getOrgManageScopes();

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Org Management</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink2">
          The full government structure - national, provinces, districts, municipalities, and
          departments - nested exactly as they cascade for access and reporting. Add a new node
          below by picking its type and its parent; a metro municipality links straight to its
          province and skips the district level.
        </p>
      </div>

      <CreateOrgForm orgs={orgs} />

      <OrgTree roots={tree} />
    </div>
  );
}
