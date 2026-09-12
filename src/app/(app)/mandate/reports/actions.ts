"use server";

/** Bulk "mark as reported" for the clause 12.1 standing report - ported from views.js's reports() footer button. */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasMandatePermission } from "@/lib/data/mandate";

type UpdateByIn = {
  update: (values: Record<string, unknown>) => { in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }> };
};

export async function markDecisionsReported(formData: FormData): Promise<void> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const ids = JSON.parse(String(formData.get("ids") ?? "[]")) as string[];
  if (!orgId || ids.length === 0) return;

  if (!(await hasMandatePermission(orgId, "edit_mandate_register"))) {
    throw new Error("You don't have permission to update decisions here.");
  }

  const supabase = await createClient();
  const table = supabase.from("mandate_decisions") as unknown as UpdateByIn;
  const { error } = await table.update({ reported_on: new Date().toISOString().slice(0, 10) }).in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/mandate/reports");
}
