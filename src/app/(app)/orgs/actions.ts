"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CREATABLE_KINDS, type OrgKind } from "@/lib/data/orgs-shared";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** ltree labels only allow [A-Za-z0-9_] - turns a free-text org name into a safe path segment. */
function slugify(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "org";
}

/**
 * Creates one org node (province, district, municipality, or department)
 * under an existing parent. The `orgs` table has no default or trigger for
 * `path` (only the parent/kind combination is validated in the DB, via
 * `valid_org_parent_kind`), so it's built here as `parent.path + '.' +
 * uniqueSlug`, matching the format already used across the seeded tree
 * (e.g. "national.free_state.xhariep.kopanong"). A numeric suffix is added
 * if the slug collides with a sibling already under the same parent.
 *
 * "national" is intentionally excluded from CREATABLE_KINDS - it's a
 * singleton seeded once, never created through this UI - so form
 * tampering that sends kind=national is rejected before it reaches the DB.
 */
export async function createOrg(formData: FormData) {
  const name = str(formData, "name");
  const kind = str(formData, "kind") as OrgKind;
  const parentId = str(formData, "parentId");
  const code = str(formData, "code");
  const isMetro = formData.get("isMetro") === "on";

  if (!name) throw new Error("Name is required.");
  if (!CREATABLE_KINDS.includes(kind)) throw new Error("Invalid org type.");
  if (!parentId) throw new Error("A parent org is required.");

  const supabase = await createClient();

  const { data: parentData, error: parentErr } = await supabase
    .from("orgs")
    .select("id, path")
    .eq("id", parentId)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (!parentData) throw new Error("Parent org not found, or you don't have access to it.");
  // Cast: `path` is an ltree column, which the generated types surface as
  // `unknown` - that collapses this select's inferred row type to `never`
  // when read back directly, so it's re-typed explicitly here instead.
  const parent = parentData as unknown as { id: string; path: string };

  // Same has_org_access pre-check used before inviteUser touches the admin
  // client - RLS re-verifies manage_org_setup on the insert itself either
  // way, this just turns a raw Postgres policy violation into a readable
  // error. Cast-and-call in one expression (not split across two
  // statements) so supabase.rpc's internal `this` binding survives - see
  // the two production incidents earlier this build where splitting it
  // caused a silent crash before any network call was made.
  const { data: allowed, error: accessErr } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>
  )("has_org_access", {
    required_permission: "manage_org_setup",
    target_org_id: parentId,
  });
  if (accessErr) throw accessErr;
  if (!allowed) throw new Error("You don't have permission to create orgs under this parent.");

  const { data: siblingsData, error: sibErr } = await supabase.from("orgs").select("path").eq("parent_id", parentId);
  if (sibErr) throw sibErr;
  const siblings = (siblingsData ?? []) as unknown as { path: string }[];
  const siblingLabels = new Set(siblings.map((s) => String(s.path).split(".").pop()));

  const base = slugify(name);
  let label = base;
  let n = 2;
  while (siblingLabels.has(label)) {
    label = `${base}_${n}`;
    n++;
  }

  const path = `${String(parent.path)}.${label}`;

  // Cast: same pragmatic workaround as the memberships insert in
  // users/actions.ts - supabase-js's generic insert() overload resolution
  // doesn't always hold up across postgrest-js versions.
  const orgsTable = supabase.from("orgs") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
  const { error: insertErr } = await orgsTable.insert([
    {
      name,
      kind,
      parent_id: parentId,
      code: code || null,
      path,
      metadata: isMetro ? { is_metro: true } : {},
    },
  ]);
  if (insertErr) throw insertErr;

  revalidatePath("/orgs");
}

/**
 * Updates one department org's Director/Manager name - the field the
 * reference tool's Departments table shows that gov's `orgs` table never
 * had until the `director_manager_name` migration. RLS (`orgs_update`,
 * gated on manage_org_setup for that row's own id) is the real gatekeeper;
 * this just turns a bare 403 into a readable error.
 */
export async function updateDepartmentDirector(formData: FormData) {
  const orgId = str(formData, "orgId");
  const directorManagerName = str(formData, "directorManagerName");
  if (!orgId) throw new Error("Missing department.");

  const supabase = await createClient();
  const table = supabase.from("orgs") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await table.update({ director_manager_name: directorManagerName || null }).eq("id", orgId);
  if (error) throw error;

  revalidatePath("/orgs");
}

/**
 * Toggles a department's is_active flag - used as the Departments table's
 * "remove" action on both `/orgs` and `/epas-setup`. Deliberately a
 * deactivate, not a hard delete: a department org can be the parent of real
 * scorecards, employees, and KPI history (none of `scorecard_kpis`,
 * `employees`, or `kpi_library` cascade-delete when an org disappears), so a
 * hard delete here would either fail on a foreign-key violation or silently
 * orphan rows depending on which table hit first. Matches the reference
 * tool's own hint text ("deleting a department does not delete its
 * scorecard data") in spirit - the scorecard data survives either way, this
 * just also keeps the org row itself intact and simply hides it from active
 * pickers/lists.
 */
export async function setOrgActive(formData: FormData) {
  const orgId = str(formData, "orgId");
  const isActive = formData.get("isActive") === "true";
  if (!orgId) throw new Error("Missing org.");

  const supabase = await createClient();
  const table = supabase.from("orgs") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await table.update({ is_active: isActive }).eq("id", orgId);
  if (error) throw error;

  revalidatePath("/orgs");
  revalidatePath("/epas-setup");
}

/**
 * Updates just the Municipal Manager name + municipality logo on the one
 * policy_templates row for a municipality, leaving every other config key
 * (Mayor identity, weighting, bonus bands, sign defaults) untouched. This is
 * a narrower sibling of epas-setup/actions.ts's savePolicyConfig - that
 * action's form always submits every policy field, so calling it directly
 * from a form that only shows MM name + logo would silently blank out the
 * Mayor/weighting/bonus-band fields set on EPAS Setup. Surfaces the same two
 * fields on SDBIP's Organisation setup screen (reference audit item #1)
 * without duplicating or risking the rest of the config.
 */
export async function updateMunicipalityIdentity(formData: FormData) {
  const orgId = str(formData, "orgId");
  const mmName = str(formData, "mmName");
  const muniLogoUrl = str(formData, "muniLogoUrl");
  if (!orgId) throw new Error("Missing municipality.");

  const supabase = await createClient();

  const { data: existingData, error: existingErr } = await supabase
    .from("policy_templates")
    .select("id, config")
    .eq("org_id", orgId)
    .eq("is_locked", true)
    .maybeSingle();
  if (existingErr) throw existingErr;
  const existing = existingData as unknown as { id: string; config: Record<string, unknown> } | null;

  const config = {
    ...(existing?.config ?? {}),
    mmName: mmName || null,
    muniLogoUrl: muniLogoUrl || null,
  };

  if (existing) {
    const table = supabase.from("policy_templates") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await table.update({ config }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const table = supabase.from("policy_templates") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await table.insert([
      { org_id: orgId, name: "SA Municipal (MSA/MFMA)", is_locked: true, version: 1, config },
    ]);
    if (error) throw error;
  }

  revalidatePath("/orgs");
  revalidatePath("/epas-setup");
}
