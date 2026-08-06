"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRESCRIBED_COMPETENCIES } from "@/lib/data/competencies";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Creates or updates the one policy_templates row for a municipality
 * (upsert on org_id, since there's exactly one active policy per
 * municipality - policy_templates.org_id has no unique constraint yet, so
 * this checks for an existing row itself rather than relying on the DB to
 * dedupe). Bonus bands arrive as a JSON string built client-side by
 * PolicyForm's dynamic row editor.
 */
export async function savePolicyConfig(formData: FormData) {
  const orgId = str(formData, "orgId");
  if (!orgId) throw new Error("Missing municipality.");

  const kpaWeight = Number(str(formData, "kpaWeight")) || 0;
  const competencyWeight = Number(str(formData, "competencyWeight")) || 0;
  const muniLogoUrl = str(formData, "muniLogoUrl");
  const mayorTitle = str(formData, "mayorTitle") || "Executive Mayor";
  const mayorName = str(formData, "mayorName");
  const mmName = str(formData, "mmName");
  const signPlaceDefault = str(formData, "signPlaceDefault");
  const signMonthDefault = str(formData, "signMonthDefault");

  let bonusBands: unknown = [];
  try {
    bonusBands = JSON.parse(str(formData, "bonusBandsJson") || "[]");
  } catch {
    throw new Error("Bonus bands were malformed - please try again.");
  }

  const supabase = await createClient();

  const { data: existingData, error: existingErr } = await supabase
    .from("policy_templates")
    .select("id, config")
    .eq("org_id", orgId)
    .eq("is_locked", true)
    .maybeSingle();
  if (existingErr) throw existingErr;
  // Cast: same pragmatic workaround used elsewhere - a partial select
  // against a table with a jsonb column sometimes collapses supabase-js's
  // inferred row type to `never`.
  const existing = existingData as unknown as { id: string; config: Record<string, unknown> } | null;

  const priorConfig = existing?.config ?? {};
  const config = {
    ...priorConfig,
    kpaWeight,
    competencyWeight,
    bonusBands,
    muniLogoUrl: muniLogoUrl || null,
    mayorTitle,
    mayorName: mayorName || null,
    mmName: mmName || null,
    signPlaceDefault: signPlaceDefault || null,
    signMonthDefault: signMonthDefault || null,
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

  revalidatePath("/epas-setup");
}

export async function saveCompetency(formData: FormData) {
  const id = str(formData, "id");
  const orgId = str(formData, "orgId");
  const name = str(formData, "name");
  const groupName = str(formData, "groupName");
  const drivingText = str(formData, "drivingText");
  if (!orgId || !name) throw new Error("Name is required.");

  const supabase = await createClient();
  const row = { org_id: orgId, name, group_name: groupName || null, driving_text: drivingText || null };

  if (id) {
    const table = supabase.from("competencies") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await table.update(row).eq("id", id);
    if (error) throw error;
  } else {
    const table = supabase.from("competencies") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await table.insert([row]);
    if (error) throw error;
  }

  revalidatePath("/epas-setup");
}

export async function deleteCompetency(formData: FormData) {
  const id = str(formData, "id");
  if (!id) throw new Error("Missing competency.");
  const supabase = await createClient();
  const { error } = await supabase.from("competencies").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/epas-setup");
}

/** Wipes and re-seeds the 12 prescribed competencies for one municipality - matches the reference tool's "Restore the 12 prescribed competencies" button. */
export async function resetCompetencies(formData: FormData) {
  const orgId = str(formData, "orgId");
  if (!orgId) throw new Error("Missing municipality.");

  const supabase = await createClient();
  const { error: delErr } = await supabase.from("competencies").delete().eq("org_id", orgId);
  if (delErr) throw delErr;

  const table = supabase.from("competencies") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await table.insert(
    PRESCRIBED_COMPETENCIES.map((c) => ({ org_id: orgId, name: c.name, group_name: c.groupName }))
  );
  if (error) throw error;

  revalidatePath("/epas-setup");
}
