import { getManageableScopes, getOrgMembers, getRoles, getAssignableOrgs } from "@/lib/data/users";
import { InviteUserForm } from "./InviteUserForm";
import { PersonAccessCell } from "./PersonAccessCell";

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

  // One row per person, not per membership - the flat one-row-per-org-access
  // table used to repeat the same name/email on however many rows a person
  // had (a Platform Admin who's also a Municipal Admin showed up twice with
  // no visual link between the rows). Grouped by user, each person's org
  // access shows as chips within their one row instead - the same "name
  // chip + role chips" pattern already used for the signed-in user in the
  // app header, just applied here to every user in the list.
  const byUser = new Map<
    string,
    { userId: string; fullName: string | null; email: string | null; memberships: typeof members }
  >();
  for (const m of members) {
    const existing = byUser.get(m.userId);
    if (existing) existing.memberships.push(m);
    else byUser.set(m.userId, { userId: m.userId, fullName: m.fullName, email: m.email, memberships: [m] });
  }
  const people = [...byUser.values()];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Manage Users</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink2">
          Invite users and control which org they can capture or manage data for. Someone who works across
          several orgs or departments shows up once below, with a chip for each org they can access.
        </p>
      </div>

      <InviteUserForm orgs={orgs} roles={roles} />

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Org access</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-ink2">
                  No users yet - invite the first one above.
                </td>
              </tr>
            ) : (
              people.map((p) => (
                <tr key={p.userId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 align-top text-ink">{p.fullName ?? "—"}</td>
                  <td className="px-4 py-2 align-top text-ink2">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <PersonAccessCell userId={p.userId} memberships={p.memberships} orgs={orgs} roles={roles} />
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
