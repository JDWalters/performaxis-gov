import { getManageableScopes, getOrgMembers, getRoles, getAssignableOrgs } from "@/lib/data/users";
import { InviteUserForm } from "./InviteUserForm";
import { RevokeButton } from "./RevokeButton";

export default async function UsersPage() {
  const scopes = await getManageableScopes();

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">Manage Users</h1>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You don&apos;t have permission to manage users. This requires the &quot;manage_users&quot; permission on
          an org - ask your Municipal Admin.
        </p>
      </div>
    );
  }

  const [members, roles, orgs] = await Promise.all([getOrgMembers(), getRoles(), getAssignableOrgs()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Manage Users</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink2">
          Invite users and control which org they can capture or manage data for. Each row below is one person&apos;s
          access to one org - the same person can have several rows if they work across departments.
        </p>
      </div>

      <InviteUserForm orgs={orgs} roles={roles} />

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Org</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink2">
                  No users yet - invite the first one above.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.membershipId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{m.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-ink2">{m.email ?? "—"}</td>
                  <td className="px-4 py-2 text-ink2">{m.orgName}</td>
                  <td className="px-4 py-2">
                    <span className="stag stag-blue">{m.roleName}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RevokeButton membershipId={m.membershipId} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
