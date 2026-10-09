"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FY_COOKIE } from "@/lib/data/financial-years";
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
 * "remove" action on both `/orgs` and `/appraisals/setup`. Deliberately a
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
  revalidatePath("/appraisals/setup");
}

/**
 * Updates just the Municipal Manager name + municipality logo on the one
 * policy_templates row for a municipality, leaving every other config key
 * (Mayor identity, weighting, bonus bands, sign defaults) untouched. This is
 * a narrower sibling of appraisals/setup/actions.ts's savePolicyConfig - that
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
  revalidatePath("/appraisals/setup");
}

/**
 * Edits one org's name and short code. `kind`, `parent_id` and `path` are
 * deliberately NOT editable here. `path` (an ltree, unique, the basis of
 * has_org_access / RLS containment) is built once at creation from a slug of
 * the *name* - the code is never part of it - and every descendant's path
 * embeds its ancestors' labels. Renaming therefore only changes the display
 * `name`; the stored path stays as-is so containment/RLS and any bookmarked
 * references are untouched. The schema has no unique constraint on `code`,
 * so uniqueness is only enforced softly: a changed code may not duplicate a
 * sibling's code (same parent), case-insensitively.
 */
export async function updateOrg(formData: FormData) {
  const orgId = str(formData, "orgId");
  const name = str(formData, "name");
  const code = str(formData, "code");
  if (!orgId) throw new Error("Missing org.");
  if (!name) throw new Error("Name is required.");
  if (name.length > 200) throw new Error("Name is too long.");
  if (code.length > 30) throw new Error("Code is too long (30 characters max).");

  const supabase = await createClient();

  const { data: allowed, error: accessErr } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>
  )("has_org_access", {
    required_permission: "manage_org_setup",
    target_org_id: orgId,
  });
  if (accessErr) throw accessErr;
  if (!allowed) throw new Error("You don't have permission to edit this org.");

  const { data: currentData, error: curErr } = await supabase
    .from("orgs")
    .select("id, parent_id, code")
    .eq("id", orgId)
    .maybeSingle();
  if (curErr) throw curErr;
  const current = currentData as unknown as { id: string; parent_id: string | null; code: string | null } | null;
  if (!current) throw new Error("Org not found, or you don't have access to it.");

  if (code && code.toLowerCase() !== (current.code ?? "").toLowerCase() && current.parent_id) {
    const { data: sibData, error: sibErr } = await supabase
      .from("orgs")
      .select("id, code")
      .eq("parent_id", current.parent_id)
      .neq("id", orgId);
    if (sibErr) throw sibErr;
    const clash = ((sibData ?? []) as unknown as { code: string | null }[]).some(
      (s) => (s.code ?? "").toLowerCase() === code.toLowerCase()
    );
    if (clash) throw new Error(`Another org under the same parent already uses the code "${code}".`);
  }

  const table = supabase.from("orgs") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        select: (cols: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
  const { data: updated, error } = await table
    .update({ name, code: code || null })
    .eq("id", orgId)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) throw new Error("Update was not applied - you may not have access to this org.");

  revalidatePath("/orgs");
  revalidatePath("/appraisals/setup");
  revalidatePath("/scorecards", "layout");
}

/**
 * Idempotent "Create scorecard" shortcut for the Org tree: finds (or creates)
 * the scorecard for `orgId` in the caller's active financial year for that
 * org's municipality, then redirects to its Scorecard setup. Only
 * municipality (Top Layer) and department orgs own scorecards. The FY is
 * resolved the same way getActiveFinancialYear does (px_fy cookie if it is
 * one of this municipality's years, else is_current, else latest). The
 * unique (org_id, financial_year_id) constraint makes a double-click safe;
 * RLS (scorecards_insert, manage_scorecard_setup) is the real gatekeeper.
 */
export async function ensureScorecard(formData: FormData) {
  const orgId = str(formData, "orgId");
  if (!orgId) throw new Error("Missing org.");

  const supabase = await createClient();
  const { data: orgData, error: orgErr } = await supabase
    .from("orgs")
    .select("id, kind, parent_id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) throw orgErr;
  const org = orgData as unknown as { id: string; kind: OrgKind; parent_id: string | null } | null;
  if (!org) throw new Error("Org not found, or you don't have access to it.");
  if (org.kind !== "municipality" && org.kind !== "department") {
    throw new Error("Only a municipality (Top Layer) or a department can own a scorecard.");
  }
  const muniId = org.kind === "municipality" ? org.id : org.parent_id;
  if (!muniId) throw new Error("Could not resolve this department's municipality.");

  const { data: fyData, error: fyErr } = await supabase
    .from("financial_years")
    .select("id, start_year, is_current")
    .eq("org_id", muniId)
    .order("start_year");
  if (fyErr) throw fyErr;
  const years = (fyData ?? []) as unknown as { id: string; start_year: number; is_current: boolean }[];
  const cookieId = (await cookies()).get(FY_COOKIE)?.value;
  const fy = years.find((y) => y.id === cookieId) ?? years.find((y) => y.is_current) ?? years[years.length - 1];
  if (!fy) throw new Error("This municipality has no financial year yet - create one first.");

  const { data: existingData, error: exErr } = await supabase
    .from("scorecards")
    .select("id")
    .eq("org_id", orgId)
    .eq("financial_year_id", fy.id)
    .maybeSingle();
  if (exErr) throw exErr;
  let scorecardId = (existingData as unknown as { id: string } | null)?.id ?? null;

  if (!scorecardId) {
    const table = supabase.from("scorecards") as unknown as {
      insert: (rows: Record<string, unknown>[]) => {
        select: (cols: string) => {
          single: () => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
        };
      };
    };
    const { data: created, error: insErr } = await table
      .insert([{ org_id: orgId, financial_year_id: fy.id }])
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") {
        // Lost a race with a concurrent create - the row exists now.
        const { data: again } = await supabase
          .from("scorecards")
          .select("id")
          .eq("org_id", orgId)
          .eq("financial_year_id", fy.id)
          .maybeSingle();
        scorecardId = (again as unknown as { id: string } | null)?.id ?? null;
      } else {
        throw new Error(insErr.message);
      }
    } else {
      scorecardId = (created as unknown as { id: string }).id;
    }
  }
  if (!scorecardId) throw new Error("Could not create the scorecard.");

  revalidatePath("/orgs");
  revalidatePath("/scorecards", "layout");
  redirect(`/scorecards/${scorecardId}/manage`);
}
