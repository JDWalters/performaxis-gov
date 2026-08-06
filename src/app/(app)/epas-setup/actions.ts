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

/**
 * Restores the 12 prescribed competencies for one municipality - matches
 * the reference tool's "Restore the 12 prescribed competencies" button.
 *
 * This used to hard-delete every competency for the org and reinsert the 12
 * prescribed ones from scratch. That's unsafe once any assessment ratings
 * have actually been captured (appraisal_competency_ratings.competency_id
 * has no ON DELETE CASCADE, by design, so we never silently lose rating
 * history) - the delete would fail outright with a foreign-key violation,
 * which is exactly the 500 this was throwing once Kopanong had real ratings
 * against its competencies. Instead this matches existing rows to the
 * prescribed list by name (case-insensitively, since old seed data used
 * different casing), updates them in place, inserts any that are missing,
 * and only ever deletes a leftover non-prescribed competency if nothing has
 * been rated against it yet.
 */
export async function resetCompetencies(formData: FormData) {
  const orgId = str(formData, "orgId");
  if (!orgId) throw new Error("Missing municipality.");

  const supabase = await createClient();

  const { data: existingData, error: existingErr } = await supabase
    .from("competencies")
    .select("id, name, group_name")
    .eq("org_id", orgId);
  if (existingErr) throw existingErr;
  const existing = (existingData ?? []) as unknown as { id: string; name: string; group_name: string | null }[];

  const byLowerName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c] as const));

  const updateTable = supabase.from("competencies") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const insertTable = supabase.from("competencies") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };

  const toInsert: Record<string, unknown>[] = [];
  for (const c of PRESCRIBED_COMPETENCIES) {
    const key = c.name.trim().toLowerCase();
    const match = byLowerName.get(key);
    if (match) {
      if (match.name !== c.name || match.group_name !== c.groupName) {
        const { error } = await updateTable.update({ name: c.name, group_name: c.groupName }).eq("id", match.id);
        if (error) throw error;
      }
      byLowerName.delete(key);
    } else {
      toInsert.push({ org_id: orgId, name: c.name, group_name: c.groupName });
    }
  }
  if (toInsert.length) {
    const { error } = await insertTable.insert(toInsert);
    if (error) throw error;
  }

  // Whatever's left in byLowerName is a competency outside the prescribed
  // 12 (a stray "New competency" row, a typo'd one, etc.) - remove it only
  // if it has zero captured ratings.
  const leftoverIds = [...byLowerName.values()].map((c) => c.id);
  if (leftoverIds.length) {
    const { data: ratedRowsData } = await supabase
      .from("appraisal_competency_ratings")
      .select("competency_id")
      .in("competency_id", leftoverIds);
    const ratedIds = new Set(
      ((ratedRowsData ?? []) as unknown as { competency_id: string }[]).map((r) => r.competency_id)
    );
    const deletable = leftoverIds.filter((id) => !ratedIds.has(id));
    if (deletable.length) {
      const { error } = await supabase.from("competencies").delete().in("id", deletable);
      if (error) throw error;
    }
  }

  revalidatePath("/epas-setup");
}
