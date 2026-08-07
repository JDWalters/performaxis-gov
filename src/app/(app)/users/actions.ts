"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

type Grant = { orgId: string; roleId: string };
type MembershipsTable = {
  insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
};

function parseGrants(formData: FormData): Grant[] {
  const raw = str(formData, "grants");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { orgId?: unknown; roleId?: unknown }[];
  return parsed
    .filter((g) => typeof g.orgId === "string" && typeof g.roleId === "string" && g.orgId && g.roleId)
    .map((g) => ({ orgId: g.orgId as string, roleId: g.roleId as string }));
}

/**
 * Invites a user and grants them a role at however many orgs were checked
 * in the OrgAccessChecklist - OR, if that email already belongs to an
 * account (someone who needs a second department, or both a Platform Admin
 * and Municipal Admin role), just adds the extra membership(s) to their
 * existing account instead. Supabase's inviteUserByEmail rejects
 * already-registered emails outright, so the two paths can't share one
 * call: this looks the email up first via listUsers (same pagination
 * approach getOrgMembers() already uses to resolve emails/names) and only
 * invites a brand-new auth user when no match is found.
 *
 * Explicitly re-checks manage_users on every checked org before touching
 * the admin client, since both inviteUserByEmail and the listUsers lookup
 * run with the service role and bypass RLS entirely - the memberships
 * insert is RLS-checked too (belt and suspenders), but user creation itself
 * has no RLS to fall back on.
 */
export async function inviteUser(formData: FormData): Promise<{ existingUser: boolean; grantCount: number }> {
  const email = str(formData, "email");
  const fullName = str(formData, "fullName");
  const grants = parseGrants(formData);

  if (!email || grants.length === 0) {
    throw new Error("Email and at least one org/role are required.");
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) throw new Error("Not signed in.");

  for (const g of grants) {
    // Cast: same pragmatic workaround used elsewhere for has_org_access - the
    // generic rpc() overload doesn't always resolve cleanly against the
    // generated Functions map across postgrest-js versions. Must stay a
    // single member-expression call (not assigned to a variable first) so
    // `rpc`'s internal `this` binding to the supabase client is preserved.
    const { data: allowed, error: accessErr } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>
    )("has_org_access", {
      required_permission: "manage_users",
      target_org_id: g.orgId,
    });
    if (accessErr) throw accessErr;
    if (!allowed) throw new Error("You don't have permission to add users to one of the checked orgs.");
  }

  const admin = createAdminClient();

  // Paginate through every auth user looking for a case-insensitive email
  // match. listUsers has no server-side email filter, so this is the same
  // brute-force approach getOrgMembers() already relies on - fine at this
  // app's scale (one municipality's worth of accounts).
  let existingUserId: string | null = null;
  const wantedEmail = email.toLowerCase();
  for (let page = 1; page <= 20 && !existingUserId; page++) {
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr) throw listErr;
    const match = usersPage.users.find((u) => u.email?.toLowerCase() === wantedEmail);
    if (match) existingUserId = match.id;
    if (usersPage.users.length < 1000) break;
  }

  const existingUser = existingUserId !== null;
  const userId = existingUserId ?? (await inviteNewUser(admin, email, fullName));

  if (existingUser) {
    // Adding orgs to someone who already has an account - drop any already
    // held so the insert below doesn't collide with an existing row.
    const { data: existingRows, error: existingErr } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userId);
    if (existingErr) throw existingErr;
    const alreadyHeld = new Set(((existingRows ?? []) as unknown as { org_id: string }[]).map((r) => r.org_id));
    const newGrants = grants.filter((g) => !alreadyHeld.has(g.orgId));
    if (newGrants.length === 0) throw new Error("This person already has access to every org you checked.");
    await insertMemberships(supabase.from("memberships") as unknown as MembershipsTable, newGrants, userId, caller.id);
    revalidatePath("/users");
    return { existingUser: true, grantCount: newGrants.length };
  }

  if (fullName) {
    // profiles insert is self-only under RLS (id = auth.uid()) - the admin
    // client bypasses that, which is fine since we already checked
    // manage_users above.
    const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, full_name: fullName });
    if (profileErr) throw profileErr;
  }

  // Insert via the caller's own session client (not admin) so RLS
  // re-verifies manage_users on every org and records invited_by.
  await insertMemberships(supabase.from("memberships") as unknown as MembershipsTable, grants, userId, caller.id);

  revalidatePath("/users");
  return { existingUser: false, grantCount: grants.length };
}

// Cast: same pragmatic workaround as the kpi_library insert in
// kpi-library/actions.ts - supabase-js's generic insert() overload
// resolution doesn't always hold up across postgrest-js versions.
async function insertMemberships(table: MembershipsTable, grants: Grant[], userId: string, invitedBy: string) {
  const { error } = await table.insert(
    grants.map((g) => ({ user_id: userId, org_id: g.orgId, role_id: g.roleId, invited_by: invitedBy }))
  );
  if (error) throw error;
}

/**
 * Replaces one person's entire set of org memberships with whatever's
 * checked in the "Edit access" panel - diffs against what they currently
 * hold so this is one save instead of clicking Revoke/re-inviting one org
 * at a time. Every insert/delete/update goes through the caller's own
 * session client, so RLS (manage_users per org) is the actual gate here,
 * not application logic - an org the caller can't manage simply won't take
 * the change.
 */
export async function updateUserAccess(formData: FormData) {
  const userId = str(formData, "userId");
  const grants = parseGrants(formData);
  if (!userId) throw new Error("Missing user.");

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) throw new Error("Not signed in.");

  const { data: currentRows, error: currentErr } = await supabase
    .from("memberships")
    .select("id, org_id, role_id")
    .eq("user_id", userId);
  if (currentErr) throw currentErr;
  const current = (currentRows ?? []) as unknown as { id: string; org_id: string; role_id: string }[];

  const wantedByOrg = new Map(grants.map((g) => [g.orgId, g.roleId]));
  const currentByOrg = new Map(current.map((r) => [r.org_id, r]));

  const toRevoke = current.filter((r) => !wantedByOrg.has(r.org_id));
  const toAdd = grants.filter((g) => !currentByOrg.has(g.orgId));
  const toUpdate = current.filter((r) => {
    const wantedRole = wantedByOrg.get(r.org_id);
    return wantedRole && wantedRole !== r.role_id;
  });

  if (toRevoke.length > 0) {
    const { error } = await supabase
      .from("memberships")
      .delete()
      .in("id", toRevoke.map((r) => r.id));
    if (error) throw error;
  }
  // Cast: same pragmatic workaround as the insert helper above - the generic
  // update() overload doesn't always resolve cleanly across postgrest-js
  // versions.
  const updateTable = supabase.from("memberships") as unknown as {
    update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
  for (const r of toUpdate) {
    const { error } = await updateTable.update({ role_id: wantedByOrg.get(r.org_id) }).eq("id", r.id);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    await insertMemberships(supabase.from("memberships") as unknown as MembershipsTable, toAdd, userId, caller.id);
  }

  revalidatePath("/users");
}

async function inviteNewUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  fullName: string
): Promise<string> {
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
  });
  if (inviteErr) throw inviteErr;
  return inviteData.user.id;
}

/** Revokes one membership (removes a user's access to one org). RLS (memberships_delete) requires manage_users on that org. */
export async function revokeMembership(formData: FormData) {
  const membershipId = str(formData, "membershipId");
  if (!membershipId) throw new Error("Missing membership.");

  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
  if (error) throw error;

  revalidatePath("/users");
}
