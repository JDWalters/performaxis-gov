"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Invites a user and grants them a role at one org - OR, if that email
 * already belongs to an account (someone who needs a second department, or
 * both a Platform Admin and Municipal Admin role), just adds the extra
 * membership to their existing account instead. Supabase's
 * inviteUserByEmail rejects already-registered emails outright, so the two
 * paths can't share one call: this looks the email up first via
 * listUsers (same pagination approach getOrgMembers() already uses to
 * resolve emails/names) and only invites a brand-new auth user when no
 * match is found.
 *
 * Explicitly re-checks manage_users on the target org before touching the
 * admin client, since both inviteUserByEmail and the listUsers lookup run
 * with the service role and bypass RLS entirely - the memberships insert is
 * RLS-checked too (belt and suspenders), but user creation itself has no
 * RLS to fall back on.
 */
export async function inviteUser(formData: FormData): Promise<{ existingUser: boolean }> {
  const email = str(formData, "email");
  const fullName = str(formData, "fullName");
  const orgId = str(formData, "orgId");
  const roleId = str(formData, "roleId");

  if (!email || !orgId || !roleId) {
    throw new Error("Email, department/org, and role are all required.");
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) throw new Error("Not signed in.");

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
    target_org_id: orgId,
  });
  if (accessErr) throw accessErr;
  if (!allowed) throw new Error("You don't have permission to add users to this org.");

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
    // Adding an org to someone who already has an account - check first so
    // the error is "they already have access here" rather than an opaque
    // constraint failure if the same org/role gets submitted twice.
    const { data: dupe, error: dupeErr } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (dupeErr) throw dupeErr;
    if (dupe) throw new Error("This person already has access to that org.");
  } else if (fullName) {
    // profiles insert is self-only under RLS (id = auth.uid()) - the admin
    // client bypasses that, which is fine since we already checked
    // manage_users above.
    const { error: profileErr } = await admin.from("profiles").upsert({ id: userId, full_name: fullName });
    if (profileErr) throw profileErr;
  }

  // Insert via the caller's own session client (not admin) so RLS
  // re-verifies manage_users on this exact org and records invited_by.
  // Cast: same pragmatic workaround as the kpi_library insert in
  // kpi-library/actions.ts - supabase-js's generic insert() overload
  // resolution doesn't always hold up across postgrest-js versions.
  const membershipsTable = supabase.from("memberships") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
  const { error: membershipErr } = await membershipsTable.insert([
    { user_id: userId, org_id: orgId, role_id: roleId, invited_by: caller.id },
  ]);
  if (membershipErr) throw membershipErr;

  revalidatePath("/users");
  return { existingUser };
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
