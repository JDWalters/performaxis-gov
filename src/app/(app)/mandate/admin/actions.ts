"use server";

/**
 * Mandate admin actions - ported from assets/admin.js and assets/library.js.
 * Everything here is gated on manage_mandate_setup (the reference's
 * can('access') / "Administrator" tier) rather than edit_mandate_register:
 * these are direct, no-approval writes to the live register - setting it up
 * - which is deliberately a higher bar than the governance workflow's
 * propose/approve amendments (task #205), matching the reference's own
 * framing of admin.js's editor as "Administrator - direct edit, no approval
 * needed, logged to the audit trail".
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasMandatePermission } from "@/lib/data/mandate";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function fail(err: { message?: string } | null | undefined): never {
  throw new Error(err?.message || "Something went wrong.");
}

async function requireAdmin(orgId: string): Promise<void> {
  if (!(await hasMandatePermission(orgId, "manage_mandate_setup"))) {
    throw new Error("You don't have permission to administer this register.");
  }
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

// Cast: same pragmatic workaround used throughout this codebase for tables
// not in the generated types.ts (see mandate.ts's header comment).
type InsertOne = { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
type InsertReturningId = {
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
  };
};
type UpdateByEq = {
  update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
};
type DeleteByEq = { delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } };
type DeleteByMatch = {
  delete: () => { eq: (col: string, val: string) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } };
};

async function logEvent(orgId: string, who: string, action: string, detail: string): Promise<void> {
  const supabase = await createClient();
  const table = supabase.from("mandate_workflow_events") as unknown as InsertOne;
  await table.insert({ org_id: orgId, who, role: "manage_mandate_setup", action, detail });
}

/* ==========================================================================
   Posts and bodies
   ========================================================================== */

export async function saveAuthority(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  const kind = str(formData, "kind") || "post";
  const name = str(formData, "name");
  const short = str(formData, "short");
  const department = str(formData, "department");
  const incumbent = str(formData, "incumbent");
  const note = str(formData, "note");
  const vacant = str(formData, "vacant") === "1";

  if (!orgId) throw new Error("Missing organisation.");
  await requireAdmin(orgId);
  if (!name) throw new Error("A name is required.");

  const supabase = await createClient();
  if (short) {
    const { data: clashes, error: clashError } = await supabase
      .from("mandate_authorities")
      .select("id, short_label")
      .eq("org_id", orgId)
      .ilike("short_label", short);
    if (clashError) fail(clashError);
    const collision = ((clashes ?? []) as { id: string; short_label: string }[]).find((a) => a.id !== id);
    if (collision) throw new Error(`"${short}" is already used by another post or body.`);
  }

  const userId = await currentUserId();
  const row = {
    org_id: orgId,
    kind,
    name,
    short_label: short || null,
    department: kind === "post" ? department || null : null,
    incumbent: kind === "post" ? incumbent || null : null,
    vacant: kind === "post" ? vacant : false,
    note: note || null,
  };

  if (id) {
    const table = supabase.from("mandate_authorities") as unknown as UpdateByEq;
    const { error } = await table.update(row).eq("id", id);
    if (error) fail(error);
    await logEvent(orgId, userId, "Post/body updated", name);
  } else {
    const table = supabase.from("mandate_authorities") as unknown as InsertOne;
    const { error } = await table.insert(row);
    if (error) fail(error);
    await logEvent(orgId, userId, "Post/body added", name);
  }

  revalidatePath("/mandate/admin/structure");
  revalidatePath("/mandate");
  revalidatePath("/mandate/authority");
}

export async function deleteAuthority(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  if (!orgId || !id) throw new Error("Missing post or body.");
  await requireAdmin(orgId);

  const supabase = await createClient();
  const { data: name } = await supabase.from("mandate_authorities").select("name").eq("id", id).maybeSingle();

  // Strip this authority out of every entry's chain arrays before deleting
  // it, rather than blocking the delete - ported from admin.js's deleteAuth
  // (it warns with a usage count, then does exactly this on confirm).
  const { data: affected, error: findError } = await supabase
    .from("mandate_entries")
    .select("id, delegating_authority, delegated_body, delegate, sub_delegate, further_sub_delegate")
    .eq("org_id", orgId)
    .or(
      `delegating_authority.cs.{${id}},delegated_body.cs.{${id}},delegate.cs.{${id}},sub_delegate.cs.{${id}},further_sub_delegate.cs.{${id}}`
    );
  if (findError) fail(findError);

  type AffectedRow = {
    id: string;
    delegating_authority: string[] | null;
    delegated_body: string[] | null;
    delegate: string[] | null;
    sub_delegate: string[] | null;
    further_sub_delegate: string[] | null;
  };
  const updateTable = supabase.from("mandate_entries") as unknown as UpdateByEq;
  for (const e of (affected ?? []) as unknown as AffectedRow[]) {
    const { error } = await updateTable
      .update({
        delegating_authority: (e.delegating_authority ?? []).filter((x) => x !== id),
        delegated_body: (e.delegated_body ?? []).filter((x) => x !== id),
        delegate: (e.delegate ?? []).filter((x) => x !== id),
        sub_delegate: (e.sub_delegate ?? []).filter((x) => x !== id),
        further_sub_delegate: (e.further_sub_delegate ?? []).filter((x) => x !== id),
      })
      .eq("id", e.id);
    if (error) fail(error);
  }

  const delTable = supabase.from("mandate_authorities") as unknown as DeleteByEq;
  const { error: delError } = await delTable.delete().eq("id", id);
  if (delError) fail(delError);

  const userId = await currentUserId();
  await logEvent(
    orgId,
    userId,
    "Post/body deleted",
    `${(name as { name: string } | null)?.name || id}${affected && affected.length ? ` (removed from ${affected.length} delegation${affected.length === 1 ? "" : "s"})` : ""}`
  );

  revalidatePath("/mandate/admin/structure");
  revalidatePath("/mandate");
  revalidatePath("/mandate/authority");
}

/* ==========================================================================
   Direct delegation entry (administrator, no approval)
   ========================================================================== */

function ids(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

export async function saveEntryDirect(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  const legislation = str(formData, "legislation");
  const description = str(formData, "description");
  if (!orgId) throw new Error("Missing organisation.");
  await requireAdmin(orgId);
  if (!legislation) throw new Error("Legislation, regulation, by-law, policy or agreement is required.");
  if (!description) throw new Error("The power conferred is required.");

  const supabase = await createClient();
  const reserved = str(formData, "reserved") === "1";
  const row = {
    legislation,
    instrument_type: str(formData, "instrumentType") || null,
    provision: str(formData, "provision") || null,
    description,
    band: legislation,
    delegating_authority: ids(formData, "delegatingAuthorityIds"),
    delegating_note: str(formData, "delegatingAuthorityNote") || null,
    status: reserved ? "reserved" : "delegated",
    delegated_body: ids(formData, "delegatedBodyIds"),
    delegated_body_note: str(formData, "delegatedBodyNote") || null,
    delegate: ids(formData, "delegateIds"),
    delegate_note: str(formData, "delegateNote") || null,
    sub_delegate: ids(formData, "subDelegateIds"),
    sub_delegate_note: str(formData, "subDelegateNote") || null,
    further_sub_delegate: ids(formData, "furtherSubDelegateIds"),
    further_sub_note: str(formData, "furtherSubDelegateNote") || null,
    conditions: str(formData, "conditions") || null,
    review_status: str(formData, "reviewStatus") || null,
    review_note: str(formData, "reviewNote") || null,
    establishment_note: str(formData, "establishmentNote") || null,
  } as Record<string, unknown>;
  row.sub_delegate_none = (row.sub_delegate as string[]).length === 0 && !row.sub_delegate_note;

  const userId = await currentUserId();

  if (id) {
    const table = supabase.from("mandate_entries") as unknown as UpdateByEq;
    const { error } = await table.update(row).eq("id", id);
    if (error) fail(error);
    await logEvent(orgId, userId, "Delegation updated directly", `${legislation} — ${description}`.slice(0, 160));
  } else {
    const { data: orgRow, error: orgError } = await supabase.from("orgs").select("metadata").eq("id", orgId).single();
    if (orgError) fail(orgError);
    const org = orgRow as { metadata: Record<string, unknown> | null } | null;
    const schedules = (org?.metadata?.mandate as { schedules?: { code: string }[] } | undefined)?.schedules;
    const schedule = schedules?.[0]?.code || "B";
    const { count } = await supabase
      .from("mandate_entries")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("schedule", schedule);
    row.org_id = orgId;
    row.schedule = schedule;
    row.ref = `${schedule}-${String((count ?? 0) + 1).padStart(4, "0")}`;
    row.source_ref = "Added directly by the administrator";
    row.reporting_category = null;
    row.threshold_linked = false;
    row.paja_linked = false;
    row.instrument_confirm = false;

    const table = supabase.from("mandate_entries") as unknown as InsertReturningId;
    const { error } = await table.insert(row).select("id").single();
    if (error) fail(error);
    await logEvent(orgId, userId, "Delegation added directly", `${row.ref} · ${legislation} — ${description}`.slice(0, 160));
  }

  revalidatePath("/mandate");
  revalidatePath("/mandate/authority");
}

export async function deleteEntryDirect(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  if (!orgId || !id) throw new Error("Missing delegation.");
  await requireAdmin(orgId);

  const supabase = await createClient();
  const { data: entry } = await supabase.from("mandate_entries").select("ref, description").eq("id", id).maybeSingle();
  const delTable = supabase.from("mandate_entries") as unknown as DeleteByEq;
  const { error } = await delTable.delete().eq("id", id);
  if (error) fail(error);

  const userId = await currentUserId();
  const e = entry as { ref: string; description: string } | null;
  await logEvent(orgId, userId, "Delegation deleted directly", e ? `${e.ref} — ${e.description}`.slice(0, 160) : id);

  revalidatePath("/mandate");
  revalidatePath("/mandate/authority");
}

/* ==========================================================================
   By-law library: adopt / remove a pack
   ========================================================================== */

/** "Municipal Manager (MM-01)" -> "MM-01"; bare short code or full name also match. Ported from library.js's resolveNames(). */
function resolveOne(text: string, authorities: { id: string; name: string; short: string | null }[]): { id: string | null; wording: string } {
  const t = text.trim();
  if (!t) return { id: null, wording: "" };
  const parenMatch = t.match(/\(([^)]+)\)\s*$/);
  const shortCandidate = parenMatch ? parenMatch[1].trim() : t;
  const byShort = authorities.find((a) => a.short && a.short.toLowerCase() === shortCandidate.toLowerCase());
  if (byShort) return { id: byShort.id, wording: "" };
  const byName = authorities.find((a) => a.name.toLowerCase() === t.toLowerCase());
  if (byName) return { id: byName.id, wording: "" };
  return { id: null, wording: t };
}

function resolveNames(
  values: string[],
  authorities: { id: string; name: string; short: string | null }[]
): { ids: string[]; note: string } {
  const ids: string[] = [];
  const wording: string[] = [];
  for (const v of values) {
    const r = resolveOne(v, authorities);
    if (r.id) ids.push(r.id);
    else if (r.wording) wording.push(r.wording);
  }
  return { ids, note: wording.join("; ") };
}

export async function adoptBylawPack(formData: FormData): Promise<{ added: number }> {
  const orgId = str(formData, "orgId");
  const packId = str(formData, "packId");
  if (!orgId || !packId) throw new Error("Missing pack.");
  await requireAdmin(orgId);

  const supabase = await createClient();
  const [{ data: pack, error: packError }, { data: rows, error: rowsError }, { data: authorityRows, error: authError }, { data: org }] =
    await Promise.all([
      supabase.from("mandate_bylaw_packs").select("id, name, bylaw_title").eq("id", packId).single(),
      supabase
        .from("mandate_bylaw_entries")
        .select(
          "provision, description, delegating_authority, delegating_note, status, delegated_body, delegated_body_note, delegate, delegate_note, sub_delegate, sub_delegate_note, further_sub_delegate, further_sub_note, conditions, reporting_category"
        )
        .eq("pack_id", packId),
      supabase.from("mandate_authorities").select("id, name, short_label").eq("org_id", orgId),
      supabase.from("orgs").select("metadata").eq("id", orgId).single(),
    ]);
  if (packError) fail(packError);
  if (rowsError) fail(rowsError);
  if (authError) fail(authError);

  const authorities = ((authorityRows ?? []) as { id: string; name: string; short_label: string | null }[]).map((a) => ({
    id: a.id,
    name: a.name,
    short: a.short_label,
  }));
  const orgMeta = (org as { metadata: Record<string, unknown> | null } | null)?.metadata ?? null;
  const schedules = (orgMeta?.mandate as { schedules?: { code: string }[] } | undefined)?.schedules;
  const schedule = schedules?.[0]?.code || "B";
  const { count } = await supabase.from("mandate_entries").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("schedule", schedule);
  let next = (count ?? 0) + 1;

  type PackEntryRow = {
    provision: string | null;
    description: string;
    delegating_authority: string[] | null;
    delegating_note: string | null;
    status: string;
    delegated_body: string[] | null;
    delegated_body_note: string | null;
    delegate: string[] | null;
    delegate_note: string | null;
    sub_delegate: string[] | null;
    sub_delegate_note: string | null;
    further_sub_delegate: string[] | null;
    further_sub_note: string | null;
    conditions: string | null;
    reporting_category: string | null;
  };

  const newRows: Record<string, unknown>[] = [];
  for (const r of (rows ?? []) as unknown as PackEntryRow[]) {
    if (!r.description) continue;
    const delegating = resolveNames(r.delegating_authority ?? [], authorities);
    const body = resolveNames(r.delegated_body ?? [], authorities);
    const delegate = resolveNames(r.delegate ?? [], authorities);
    const sub = resolveNames(r.sub_delegate ?? [], authorities);
    newRows.push({
      org_id: orgId,
      pack_id: packId,
      schedule,
      ref: `${schedule}-${String(next++).padStart(4, "0")}`,
      band: (pack as { name: string }).name,
      legislation: (pack as { bylaw_title: string }).bylaw_title,
      provision: r.provision,
      description: r.description,
      delegating_authority: delegating.ids,
      delegating_note: [r.delegating_note, delegating.note].filter(Boolean).join("; ") || null,
      status: r.status || "delegated",
      delegated_body: body.ids,
      delegated_body_note: [r.delegated_body_note, body.note].filter(Boolean).join("; ") || null,
      delegate: delegate.ids,
      delegate_note: [r.delegate_note, delegate.note].filter(Boolean).join("; ") || null,
      sub_delegate: sub.ids,
      sub_delegate_note: [r.sub_delegate_note, sub.note].filter(Boolean).join("; ") || null,
      sub_delegate_none: sub.ids.length === 0 && !r.sub_delegate_note,
      further_sub_delegate: [],
      further_sub_note: r.further_sub_note,
      conditions: r.conditions,
      reporting_category: r.reporting_category,
      threshold_linked: false,
      paja_linked: false,
      instrument_confirm: false,
      source_ref: `By-law library: ${(pack as { name: string }).name}`,
    });
  }

  if (newRows.length) {
    const table = supabase.from("mandate_entries") as unknown as InsertOne;
    const { error } = await table.insert(newRows as unknown as Record<string, unknown>);
    if (error) fail(error);
  }

  const userId = await currentUserId();
  await logEvent(orgId, userId, "By-law pack adopted", `${(pack as { name: string }).name} — ${newRows.length} delegation${newRows.length === 1 ? "" : "s"} added`);

  revalidatePath("/mandate/admin/library");
  revalidatePath("/mandate");
  return { added: newRows.length };
}

export async function removeBylawPack(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const packId = str(formData, "packId");
  if (!orgId || !packId) throw new Error("Missing pack.");
  await requireAdmin(orgId);

  const supabase = await createClient();
  const { data: pack } = await supabase.from("mandate_bylaw_packs").select("name").eq("id", packId).maybeSingle();
  const { count } = await supabase.from("mandate_entries").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("pack_id", packId);

  const delTable = supabase.from("mandate_entries") as unknown as DeleteByMatch;
  const { error } = await delTable.delete().eq("org_id", orgId).eq("pack_id", packId);
  if (error) fail(error);

  const userId = await currentUserId();
  await logEvent(orgId, userId, "By-law pack removed", `${(pack as { name: string } | null)?.name || packId} — ${count ?? 0} delegation${count === 1 ? "" : "s"} removed`);

  revalidatePath("/mandate/admin/library");
  revalidatePath("/mandate");
}
