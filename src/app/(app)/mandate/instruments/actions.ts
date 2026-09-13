"use server";

/**
 * Instruments (Annexure C) - server actions ported from assets/edit.js's
 * instrument()/drawInstrument() save handler. Issuing/accepting/withdrawing
 * an instrument is a direct write (no draft/approve workflow in the
 * reference app - "Issue instrument" saves immediately), so this is gated on
 * edit_mandate_register - the same permission the governance workspace's
 * "propose an amendment" action uses (Mandate Editor and above) - rather
 * than manage_mandate_setup (admin.ts's higher, "administer the whole
 * register" bar). The reference app itself draws no distinction between
 * "record an instrument" and "edit the register" - both are open to any
 * signed-in user for the org - so edit_mandate_register is the closest match
 * under this app's own RBAC tiers.
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

async function requireEditor(orgId: string): Promise<void> {
  if (!(await hasMandatePermission(orgId, "edit_mandate_register"))) {
    throw new Error("You don't have permission to issue instruments here.");
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
type UpdateByEq = {
  update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
};
type DeleteByEq = { delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } };

async function logEvent(orgId: string, who: string, action: string, detail: string): Promise<void> {
  const supabase = await createClient();
  const table = supabase.from("mandate_workflow_events") as unknown as InsertOne;
  await table.insert({ org_id: orgId, who, role: "edit_mandate_register", action, detail });
}

/** Save (create or update) an instrument. Ported field-for-field from drawInstrument()'s "Save instrument" handler, including its two validations. */
export async function saveInstrument(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  const entryId = str(formData, "entryId");
  const fromPostId = str(formData, "fromPostId");
  const toPostId = str(formData, "toPostId");
  const status = str(formData, "status") || "draft";

  if (!orgId) throw new Error("Missing organisation.");
  await requireEditor(orgId);
  if (!entryId) throw new Error("Choose the power being delegated.");
  if (!fromPostId || !toPostId) throw new Error("Set who is delegating and who receives it.");

  const supabase = await createClient();

  // A vacant post cannot accept a delegation - ported from the reference's
  // save-time check (it also warns about this live in the form, see
  // InstrumentsClient's toVacant banner).
  if (status === "accepted") {
    const { data: toRow, error: toError } = await supabase.from("mandate_authorities").select("vacant").eq("id", toPostId).maybeSingle();
    if (toError) fail(toError);
    if ((toRow as { vacant: boolean } | null)?.vacant) throw new Error("A vacant post cannot accept a delegation.");
  }

  const row = {
    org_id: orgId,
    entry_id: entryId,
    from_post: fromPostId,
    to_post: toPostId,
    conditions: str(formData, "conditions") || null,
    issued_on: str(formData, "issuedOn") || null,
    accepted_on: str(formData, "acceptedOn") || null,
    withdrawn_on: str(formData, "withdrawnOn") || null,
    status,
  };

  const userId = await currentUserId();
  const { data: entryRow } = await supabase.from("mandate_entries").select("ref").eq("id", entryId).maybeSingle();
  const ref = (entryRow as { ref: string } | null)?.ref || entryId;

  if (id) {
    const table = supabase.from("mandate_instruments") as unknown as UpdateByEq;
    const { error } = await table.update(row).eq("id", id);
    if (error) fail(error);
    await logEvent(orgId, userId, "Instrument updated", `${ref} — ${status}`);
  } else {
    const table = supabase.from("mandate_instruments") as unknown as InsertOne;
    const { error } = await table.insert(row);
    if (error) fail(error);
    await logEvent(orgId, userId, "Instrument issued", `${ref} — ${status}`);
  }

  revalidatePath("/mandate/instruments");
  revalidatePath("/mandate");
}

export async function deleteInstrument(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  if (!orgId || !id) throw new Error("Missing instrument.");
  await requireEditor(orgId);

  const supabase = await createClient();
  const delTable = supabase.from("mandate_instruments") as unknown as DeleteByEq;
  const { error } = await delTable.delete().eq("id", id);
  if (error) fail(error);

  const userId = await currentUserId();
  await logEvent(orgId, userId, "Instrument deleted", id);

  revalidatePath("/mandate/instruments");
  revalidatePath("/mandate");
}

/** "Record acceptance" quick action from the list row - ported from views.js's acceptInstrument() window.prompt flow, done here as a date field instead of a prompt(). */
export async function acceptInstrument(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  const acceptedOn = str(formData, "acceptedOn");
  if (!orgId || !id) throw new Error("Missing instrument.");
  await requireEditor(orgId);
  if (!acceptedOn) throw new Error("Give the date of acceptance.");

  const supabase = await createClient();
  const { data: toRow } = await supabase
    .from("mandate_instruments")
    .select("to_post")
    .eq("id", id)
    .maybeSingle();
  const toPost = (toRow as { to_post: string | null } | null)?.to_post;
  if (toPost) {
    const { data: authRow } = await supabase.from("mandate_authorities").select("vacant").eq("id", toPost).maybeSingle();
    if ((authRow as { vacant: boolean } | null)?.vacant) throw new Error("That post is vacant — an instrument cannot be accepted against it.");
  }

  const table = supabase.from("mandate_instruments") as unknown as UpdateByEq;
  const { error } = await table.update({ accepted_on: acceptedOn, status: "accepted" }).eq("id", id);
  if (error) fail(error);

  const userId = await currentUserId();
  await logEvent(orgId, userId, "Acceptance recorded", `${id} — ${acceptedOn}`);

  revalidatePath("/mandate/instruments");
  revalidatePath("/mandate");
}
