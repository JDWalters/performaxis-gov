import { createClient } from "@/lib/supabase/server";
import { getMyAccessibleOrgs, getMyMemberships } from "@/lib/data/access";
import { isMetroOf, parentKindFor } from "@/lib/data/orgs-shared";
import type { OrgKind, OrgNode, OrgOption } from "@/lib/data/orgs-shared";

export type { OrgKind, OrgNode, OrgOption } from "@/lib/data/orgs-shared";
export { KIND_LABEL, CREATABLE_KINDS } from "@/lib/data/orgs-shared";

/**
 * The full org tree the signed-in user can see, nested under real parents.
 * RLS on `orgs` (has_any_org_access) already scopes the flat rows to
 * whatever the caller's membership(s) cover - a Platform Admin at the root
 * national org sees everything, a Municipal Admin only sees their own
 * municipality + its departments. Any node whose parent isn't in the same
 * result set (outside the caller's visible scope) becomes a root of the
 * returned forest instead of being dropped.
 */
export async function getOrgTree(): Promise<OrgNode[]> {
  const flat = await getMyAccessibleOrgs();

  const nodes = new Map<string, OrgNode>();
  for (const o of flat) {
    nodes.set(o.id, {
      id: o.id,
      name: o.name,
      kind: o.kind,
      code: o.code,
      parentId: o.parent_id,
      isActive: o.is_active,
      isMetro: isMetroOf(o),
      path: String(o.path),
      children: [],
    });
  }

  const roots: OrgNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (list: OrgNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of list) sortTree(n.children);
  };
  sortTree(roots);

  return roots;
}

export type OrgManageScope = { orgId: string; orgName: string };

/**
 * The org(s) the signed-in user holds "manage_org_setup" on - if empty, the
 * Org Management screen is hidden entirely. Same pattern as
 * getManageableScopes() in users.ts: checked live via has_org_access rather
 * than inferred from role name.
 */
export async function getOrgManageScopes(): Promise<OrgManageScope[]> {
  const supabase = await createClient();
  const memberships = await getMyMemberships();

  const scopes: OrgManageScope[] = [];
  for (const m of memberships) {
    // Cast-and-call in one expression - see the note in users.ts for why
    // splitting this across two statements breaks supabase.rpc's `this`
    // binding and silently crashes before any network call is made.
    const { data } = await (
      supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>
    )("has_org_access", {
      required_permission: "manage_org_setup",
      target_org_id: m.org_id,
    });
    if (data) scopes.push({ orgId: m.org_id, orgName: m.org_name });
  }
  return scopes;
}

/** Flat, alphabetised list of every org the caller can see - the source for parent pickers. */
export async function getFlatOrgs(): Promise<OrgOption[]> {
  const flat = await getMyAccessibleOrgs();
  return flat
    .map((o) => ({ id: o.id, name: o.name, kind: o.kind, code: o.code, path: String(o.path) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which orgs are valid parents for a new org of `kind` - server-side source
 * of truth, built on the same parentKindFor() rule the client form uses for
 * instant filtering, so the DB trigger never rejects what the UI offered.
 */
export async function getValidParentOrgs(kind: OrgKind, isMetro: boolean): Promise<OrgOption[]> {
  if (kind === "national") return [];
  const orgs = await getFlatOrgs();
  const parentKind = parentKindFor(kind, isMetro);
  return orgs.filter((o) => o.kind === parentKind);
}
