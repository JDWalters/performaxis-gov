"use server";

/**
 * Decision log (Clause 12) - server actions ported from assets/edit.js's
 * decision()/drawDecision() save handler. Like instruments, logging a
 * decision is a direct write in the reference app (no draft/approve step),
 * so this is gated on edit_mandate_register - see instruments/actions.ts's
 * header comment for why that permission (not manage_mandate_setup) is the
 * right match under this app's RBAC tiers.
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
    throw new Error("You don't have permission to log decisions here.");
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

/** Save (create or update) a decision. Ported field-for-field from drawDecision()'s "Save decision" handler, including its two validations. */
export async function saveDecision(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  const entryId = str(formData, "entryId");
  const summary = str(formData, "summary");

  if (!orgId) throw new Error("Missing organisation.");
  await requireEditor(orgId);
  if (!entryId) throw new Error("Choose the entry the decision was taken under.");
  if (!summary) throw new Error("Say what was decided.");

  const amountRaw = str(formData, "amount");
  const row = {
    org_id: orgId,
    entry_id: entryId,
    decided_on: str(formData, "date") || null,
    taken_by: str(formData, "takenById") || null,
    summary,
    note: str(formData, "note") || null,
    amount: amountRaw ? Number(amountRaw) : null,
    category: str(formData, "category") || null,
    reported_on: str(formData, "reportedOn") || null,
  };

  const supabase = await createClient();
  const userId = await currentUserId();
  const { data: entryRow } = await supabase.from("mandate_entries").select("ref").eq("id", entryId).maybeSingle();
  const ref = (entryRow as { ref: string } | null)?.ref || entryId;

  if (id) {
    const table = supabase.from("mandate_decisions") as unknown as UpdateByEq;
    const { error } = await table.update(row).eq("id", id);
    if (error) fail(error);
    await logEvent(orgId, userId, "Decision updated", `${ref} — ${summary}`.slice(0, 160));
  } else {
    const table = supabase.from("mandate_decisions") as unknown as InsertOne;
    const { error } = await table.insert(row);
    if (error) fail(error);
    await logEvent(orgId, userId, "Decision logged", `${ref} — ${summary}`.slice(0, 160));
  }

  revalidatePath("/mandate/decisions");
  revalidatePath("/mandate");
}

export async function deleteDecision(formData: FormData): Promise<void> {
  const orgId = str(formData, "orgId");
  const id = str(formData, "id");
  if (!orgId || !id) throw new Error("Missing decision.");
  await requireEditor(orgId);

  const supabase = await createClient();
  const delTable = supabase.from("mandate_decisions") as unknown as DeleteByEq;
  const { error } = await delTable.delete().eq("id", id);
  if (error) fail(error);

  const userId = await currentUserId();
  await logEvent(orgId, userId, "Decision deleted", id);

  revalidatePath("/mandate/decisions");
  revalidatePath("/mandate");
}
