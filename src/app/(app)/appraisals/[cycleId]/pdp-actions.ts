"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Adds a blank development need to the plan - the reference's "+ Add development need". */
export async function addPdpItem(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  if (!cycleId) throw new Error("Missing cycle.");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pdp_items")
    .select("sort_order")
    .eq("appraisal_cycle_id", cycleId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = ((existing ?? [])[0] as unknown as { sort_order: number } | undefined)?.sort_order ?? -1;

  const table = supabase.from("pdp_items") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await table.insert([
    { appraisal_cycle_id: cycleId, status: "Planned", sort_order: nextSort + 1 },
  ]);
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

const PDP_FIELDS = new Set([
  "priority",
  "gap",
  "outcome",
  "activity",
  "mode",
  "timeframe",
  "opportunity",
  "support_person",
  "days",
  "status",
]);

/** Updates one field on a development need. */
export async function updatePdpItemField(formData: FormData) {
  const id = str(formData, "id");
  const cycleId = str(formData, "cycleId");
  const field = str(formData, "field");
  const value = str(formData, "value");
  if (!id || !PDP_FIELDS.has(field)) throw new Error("Invalid field.");

  const supabase = await createClient();
  const table = supabase.from("pdp_items") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const parsedValue: string | number | null = field === "days" ? (value ? Number(value) : null) : value || null;
  const { error } = await table.update({ [field]: parsedValue }).eq("id", id);
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Removes a development need from the plan. */
export async function deletePdpItem(formData: FormData) {
  const id = str(formData, "id");
  const cycleId = str(formData, "cycleId");
  if (!id) throw new Error("Missing item.");

  const supabase = await createClient();
  const { error } = await supabase.from("pdp_items").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}
