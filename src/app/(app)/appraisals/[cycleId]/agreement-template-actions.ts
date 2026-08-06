"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

type StoredConfig = Record<string, unknown> & {
  reviewDates?: [string | null, string | null, string | null, string | null];
};

/**
 * Updates one municipality-wide agreement template field - place/day/month
 * of signature, or one quarter's review-due date - the same S.cfg values
 * the reference tool exposes right on the "Employee Performance Agreement"
 * page (not tucked away in Setup) because they're inserted directly into
 * every employee's agreement text and review schedule (clause 7). This is
 * org-wide config, not a per-employee value, hence writing straight to
 * policy_templates.config (same table/row EPAS Setup's PolicyForm writes
 * to) rather than the per-cycle `agreements` row.
 */
export async function saveAgreementTemplateField(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const orgId = str(formData, "orgId");
  const field = str(formData, "field");
  const value = str(formData, "value");
  if (!orgId || !field) throw new Error("Missing municipality or field.");

  const supabase = await createClient();

  const { data: existingData, error: existingErr } = await supabase
    .from("policy_templates")
    .select("id, config")
    .eq("org_id", orgId)
    .eq("is_locked", true)
    .maybeSingle();
  if (existingErr) throw existingErr;
  const existing = existingData as unknown as { id: string; config: StoredConfig } | null;

  const priorConfig: StoredConfig = existing?.config ?? {};
  const reviewDates: [string | null, string | null, string | null, string | null] = priorConfig.reviewDates?.length === 4
    ? [...priorConfig.reviewDates]
    : [null, null, null, null];

  let config: StoredConfig;
  if (field.startsWith("reviewDate")) {
    const idx = Number(field.replace("reviewDate", ""));
    if (idx < 0 || idx > 3) throw new Error("Invalid review date index.");
    reviewDates[idx] = value || null;
    config = { ...priorConfig, reviewDates };
  } else if (["signPlaceDefault", "signDayDefault", "signMonthDefault"].includes(field)) {
    config = { ...priorConfig, [field]: value || null };
  } else {
    throw new Error("Invalid field.");
  }

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

  if (cycleId) revalidatePath(`/appraisals/${cycleId}`);
  revalidatePath("/epas-setup");
}
