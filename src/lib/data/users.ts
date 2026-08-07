import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyMemberships, getMyAccessibleOrgs } from "@/lib/data/access";

export type ManageableScope = { orgId: string; orgName: string };

/**
 * The org(s) the signed-in user holds "manage_users" on - if empty, they
 * can't see or use the Manage Users screen at all. Checked live against RLS
 * (has_org_access), not inferred from role name, so it stays correct if
 * roles/permissions change later.
 */
export async function getManageableScopes(): Promise<ManageableScope[]> {
  const supabase = await createClient();
  const memberships = await getMyMemberships();

  const scopes: ManageableScope[] = [];
  for (const m of memberships) {
    // Cast: same pragmatic workaround used elsewhere for has_org_access - the
    // generic rpc() overload doesn't always resolve cleanly against the
    // generated Functions map across postgrest-js versions. Must stay a
    // single member-expression call (not assigned to a variable first) so
    // `rpc`'s internal `this` binding to the supabase client is preserved.
    const { data } = await (
      supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>
    )("has_org_access", {
      required_permission: "manage_users",
      target_org_id: m.org_id,
    });
    if (data) scopes.push({ orgId: m.org_id, orgName: m.org_name });
  }
  return scopes;
}

export type RoleOption = { id: string; name: string };

export async function getRoles(): Promise<RoleOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export type OrgOption = { id: string; name: string; kind: string };

/** Orgs the caller can assign a new membership to - their accessible tree. */
export async function getAssignableOrgs(): Promise<OrgOption[]> {
  const orgs = await getMyAccessibleOrgs();
  return orgs
    .map((o) => ({ id: o.id, name: o.name, kind: o.kind }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type MemberRow = {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  roleId: string;
  roleName: string;
  orgId: string;
  orgName: string;
  createdAt: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  created_at: string;
  org: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
};

/**
 * Every membership within the orgs the caller manages (RLS already scopes
 * `memberships` reads to "own row OR has_org_access(manage_users)", so no
 * extra filtering needed there). Full names and emails both live in
 * RLS-protected/unreachable tables from another user's perspective -
 * `profiles` is self-select-only, and emails live in `auth.users`, which
 * PostgREST doesn't expose at all - so both are fetched separately via the
 * service-role admin client (bypasses RLS) and merged in by user id. If
 * that key isn't configured yet, the list still renders, just with blanks.
 */
export async function getOrgMembers(): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, created_at, org:orgs(id, name), role:roles(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as MembershipRow[];

  const emailById = new Map<string, string>();
  const nameById = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const [{ data: usersData }, { data: profilesData }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("id, full_name"),
    ]);
    for (const u of usersData?.users ?? []) if (u.email) emailById.set(u.id, u.email);
    for (const p of profilesData ?? []) if (p.full_name) nameById.set(p.id, p.full_name);
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured yet - list still works, just without names/emails.
  }

  return rows.map((r) => ({
    membershipId: r.id,
    userId: r.user_id,
    fullName: nameById.get(r.user_id) ?? null,
    email: emailById.get(r.user_id) ?? null,
    roleId: r.role?.id ?? "",
    roleName: r.role?.name ?? "—",
    orgId: r.org?.id ?? "",
    orgName: r.org?.name ?? "—",
    createdAt: r.created_at,
  }));
}
