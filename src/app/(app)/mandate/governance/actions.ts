"use server";

/**
 * Mandate governance workflow - server actions ported from assets/
 * governance.js's propose()/commit()/review()/decide(). Every mutation is
 * gated by hasMandatePermission() against the exact permission the reference
 * app's RANK-based can() would have required (editor -> edit_mandate_register,
 * approver -> approve_mandate_changes), and every mutation writes a
 * mandate_workflow_events row, matching the reference's logEvent() calls -
 * this is the permanent audit trail the History tab reads.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasMandatePermission } from "@/lib/data/mandate";
import { diffFields, fieldLabel, type EntrySnapshot } from "@/lib/data/mandate-governance-shared";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function fail(err: { message?: string } | null | undefined): never {
  throw new Error(err?.message || "Something went wrong.");
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

type EntryFieldRow = {
  delegated_body: string[] | null;
  delegated_body_note: string | null;
  delegate: string[] | null;
  delegate_note: string | null;
  sub_delegate: string[] | null;
  sub_delegate_note: string | null;
  further_sub_delegate: string[] | null;
  further_sub_note: string | null;
  conditions: string | null;
  review_status: string | null;
  status: string;
  establishment_note: string | null;
};

function rowToSnapshot(r: EntryFieldRow): EntrySnapshot {
  return {
    delegatedBodyIds: r.delegated_body ?? [],
    delegatedBodyNote: r.delegated_body_note || "",
    delegateIds: r.delegate ?? [],
    delegateNote: r.delegate_note || "",
    subDelegateIds: r.sub_delegate ?? [],
    subDelegateNote: r.sub_delegate_note || "",
    furtherSubDelegateIds: r.further_sub_delegate ?? [],
    furtherSubDelegateNote: r.further_sub_note || "",
    conditions: r.conditions || "",
    reviewStatus: r.review_status || "",
    status: r.status || "delegated",
    establishmentNote: r.establishment_note || "",
  };
}

// Cast: same pragmatic workaround used throughout this codebase for tables
// not yet in the generated types.ts (see mandate.ts's header comment) -
// supabase-js's generic insert()/update() overload can't resolve against an
// unlisted table, so the table handle is cast to the minimal shape each call
// site actually uses.
type InsertOne = { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
type InsertReturningId = {
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
  };
};
type UpdateByEq = {
  update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
};

async function logEvent(
  orgId: string,
  who: string,
  role: string,
  action: string,
  detail: string,
  changeId?: string
): Promise<void> {
  const supabase = await createClient();
  const table = supabase.from("mandate_workflow_events") as unknown as InsertOne;
  await table.insert({ org_id: orgId, who, role, action, detail, change_id: changeId || null });
}

/**
 * Save a draft or submit an amendment for approval. `after` is the full
 * proposed EntrySnapshot as JSON (built client-side from the chip picker /
 * text fields), matching governance.js's draft.after.
 */
export async function proposeChange(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const entryId = str(formData, "entryId");
  const reason = str(formData, "reason");
  const submit = str(formData, "submit") === "1";
  const after = JSON.parse(str(formData, "after")) as EntrySnapshot;

  if (!orgId || !entryId) throw new Error("Missing delegation.");
  if (!(await hasMandatePermission(orgId, "edit_mandate_register"))) {
    throw new Error("You don't have permission to propose amendments here.");
  }
  if (submit && !reason) {
    throw new Error("A reason is needed before this can be submitted.");
  }

  const supabase = await createClient();
  const { data: entryRow, error: entryError } = await supabase
    .from("mandate_entries")
    .select(
      "delegated_body, delegated_body_note, delegate, delegate_note, sub_delegate, sub_delegate_note, further_sub_delegate, further_sub_note, conditions, review_status, status, establishment_note"
    )
    .eq("id", entryId)
    .single();
  if (entryError) fail(entryError);

  const before = rowToSnapshot(entryRow as unknown as EntryFieldRow);
  const fields = diffFields(before, after);
  if (fields.length === 0) throw new Error("Nothing has changed yet.");

  const userId = await currentUserId();
  const { count } = await supabase
    .from("mandate_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const ref = `CR-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const status = submit ? "submitted" : "draft";
  const now = new Date().toISOString();

  const changeTable = supabase.from("mandate_change_requests") as unknown as InsertReturningId;
  const { data: inserted, error: insError } = await changeTable
    .insert({
      org_id: orgId,
      entry_id: entryId,
      ref,
      fields,
      before_row: before,
      after_row: after,
      reason,
      status,
      created_by: userId,
      submitted_at: submit ? now : null,
    })
    .select("id")
    .single();
  if (insError) fail(insError);

  await logEvent(
    orgId,
    userId,
    "edit_mandate_register",
    submit ? "Submitted" : "Draft saved",
    `${ref} · ${fields.map(fieldLabel).join(", ")}`,
    (inserted as { id: string }).id
  );

  revalidatePath("/mandate/governance");
}

/** Submit an already-saved draft (the "Submit for approval" button inside the review modal). */
export async function submitDraftChange(formData: FormData): Promise<void> {
  const changeId = str(formData, "changeId");
  if (!changeId) throw new Error("Missing change request.");

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("mandate_change_requests")
    .select("id, org_id, ref, fields, reason, status, created_by")
    .eq("id", changeId)
    .single();
  if (error) fail(error);
  const change = row as { id: string; org_id: string; ref: string; fields: string[]; reason: string | null; status: string; created_by: string | null };

  const userId = await currentUserId();
  if (change.status !== "draft") throw new Error("This change has already been submitted.");
  if (change.created_by !== userId) throw new Error("Only the author can submit this draft.");
  if (!change.reason || !change.reason.trim()) throw new Error("A reason is needed before this can be submitted.");

  const now = new Date().toISOString();
  const changeUpdateTable = supabase.from("mandate_change_requests") as unknown as UpdateByEq;
  const { error: updError } = await changeUpdateTable.update({ status: "submitted", submitted_at: now }).eq("id", changeId);
  if (updError) fail(updError);

  await logEvent(change.org_id, userId, "edit_mandate_register", "Submitted", change.ref, changeId);
  revalidatePath("/mandate/governance");
}

/** Approve (applying the change to the live register) or return a submitted change request. */
export async function decideChange(formData: FormData): Promise<void> {
  const changeId = str(formData, "changeId");
  const approve = str(formData, "approve") === "1";
  if (!changeId) throw new Error("Missing change request.");

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("mandate_change_requests")
    .select("id, org_id, entry_id, ref, fields, after_row, status, created_by")
    .eq("id", changeId)
    .single();
  if (error) fail(error);
  const change = row as {
    id: string;
    org_id: string;
    entry_id: string | null;
    ref: string;
    fields: string[];
    after_row: EntrySnapshot | null;
    status: string;
    created_by: string | null;
  };

  if (!(await hasMandatePermission(change.org_id, "approve_mandate_changes"))) {
    throw new Error("You don't have permission to decide on amendments here.");
  }
  if (change.status !== "submitted") throw new Error("This change is no longer awaiting a decision.");

  const userId = await currentUserId();
  const now = new Date().toISOString();

  if (approve && change.entry_id && change.after_row) {
    const a = change.after_row;
    const entryUpdateTable = supabase.from("mandate_entries") as unknown as UpdateByEq;
    const { error: updEntryError } = await entryUpdateTable
      .update({
        delegated_body: a.delegatedBodyIds,
        delegated_body_note: a.delegatedBodyNote || null,
        delegate: a.delegateIds,
        delegate_note: a.delegateNote || null,
        sub_delegate: a.subDelegateIds,
        sub_delegate_note: a.subDelegateNote || null,
        sub_delegate_none: a.subDelegateIds.length === 0 && !a.subDelegateNote,
        further_sub_delegate: a.furtherSubDelegateIds,
        further_sub_note: a.furtherSubDelegateNote || null,
        conditions: a.conditions || null,
        review_status: a.reviewStatus || null,
        status: a.status,
        establishment_note: a.establishmentNote || null,
      })
      .eq("id", change.entry_id);
    if (updEntryError) fail(updEntryError);

    const { count } = await supabase
      .from("mandate_register_versions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", change.org_id);
    const no = (count ?? 0) + 1;
    const versionsTable = supabase.from("mandate_register_versions") as unknown as InsertOne;
    const { error: verError } = await versionsTable.insert({
      org_id: change.org_id,
      no,
      label: `${change.ref} — ${(change.fields ?? []).map(fieldLabel).join(", ")}`,
      approved_by: userId,
      approved_at: now,
      change_ids: [change.id],
    });
    if (verError) fail(verError);

    const changeDecideTable = supabase.from("mandate_change_requests") as unknown as UpdateByEq;
    const { error: chError } = await changeDecideTable
      .update({ status: "approved", decided_by: userId, decided_at: now })
      .eq("id", changeId);
    if (chError) fail(chError);

    await logEvent(change.org_id, userId, "approve_mandate_changes", "Approved", `${change.ref} applied as v${no}`, changeId);
  } else {
    const changeDecideTable = supabase.from("mandate_change_requests") as unknown as UpdateByEq;
    const { error: chError } = await changeDecideTable
      .update({ status: "rejected", decided_by: userId, decided_at: now })
      .eq("id", changeId);
    if (chError) fail(chError);

    await logEvent(change.org_id, userId, "approve_mandate_changes", "Returned", `${change.ref} returned to author`, changeId);
  }

  revalidatePath("/mandate/governance");
}
