import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Membership = {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_kind: Tables<"orgs">["kind"];
  role_name: string;
  scope_type: Tables<"roles">["scope_type"];
};

export type AccessibleOrg = Tables<"orgs">;

/** The signed-in user's memberships (which org(s) they're attached to, and how). */
export async function getMyMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_memberships");
  if (error) throw error;
  return data ?? [];
}

/** Every org node the signed-in user can see - their own node(s) plus all descendants. */
export async function getMyAccessibleOrgs(): Promise<AccessibleOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_accessible_orgs");
  if (error) throw error;
  return data ?? [];
}

export async function getMyProfile(): Promise<{ user: import("@supabase/supabase-js").User; profile: Tables<"profiles"> | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}
