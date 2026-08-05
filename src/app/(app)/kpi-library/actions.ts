"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { KpiCalc, CalcType } from "@/lib/data/kpi-calc-shared";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Builds the calc_config.calc object from the policy writer's type-specific
 * form fields - this is the one place that turns "I picked Ratio/percentage,
 * numerator label X, fixed denominator 12" into the same jsonb shape the
 * capture forms (KpiCaptureCard / AppraisalCaptureCard) already know how to
 * render and compute against.
 */
function buildCalc(formData: FormData): KpiCalc {
  const type = str(formData, "calcType") as CalcType;
  const labels = str(formData, "labels")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const calc: KpiCalc = { type };
  if (labels.length) calc.labels = labels;

  if (type === "ratio") {
    const unit = str(formData, "unit");
    const den = str(formData, "den");
    if (unit) calc.unit = unit;
    if (den) calc.den = Number(den);
    calc.x100 = formData.get("x100") === "on";
  }

  if (type === "single") {
    const unit = str(formData, "unit");
    if (unit) calc.unit = unit;
  }

  if (type === "three") {
    calc.formula = str(formData, "formula") || "(a-b)/c";
  }

  if (type === "rating") {
    const scale = str(formData, "scale");
    calc.scale = scale ? Number(scale) : 5;
  }

  return calc;
}

/**
 * Creates or updates a kpi_library entry from the KPI Type Generator form.
 * RLS (kpilib_insert/kpilib_update, via has_org_access "manage_scorecard_setup")
 * is the real gatekeeper - only a policy writer with that permission on the
 * chosen department can save.
 */
export async function saveKpiLibraryEntry(formData: FormData) {
  const id = str(formData, "id");
  const orgId = str(formData, "orgId");
  const name = str(formData, "name");
  const description = str(formData, "description");
  const kpa = str(formData, "kpa");
  const idpRef = str(formData, "idpRef");
  const unitOfMeasure = str(formData, "unitOfMeasure");
  const targetType = str(formData, "targetType") || "stand-alone";

  if (!orgId || !name) {
    throw new Error("Department and KPI name are required.");
  }

  const calc = buildCalc(formData);

  const supabase = await createClient();
  const row = {
    org_id: orgId,
    name,
    description: description || null,
    kpa: kpa || null,
    idp_ref: idpRef || null,
    unit_of_measure: unitOfMeasure || null,
    target_type: targetType,
    calc_config: { calc },
  };

  // Cast: same pragmatic workaround as the upsert cast in scorecards/actions.ts -
  // supabase-js's generic insert()/update() overload resolution doesn't always
  // hold up across postgrest-js versions.
  const kpiLibrary = supabase.from("kpi_library") as unknown as {
    update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };

  if (id) {
    const { error } = await kpiLibrary.update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await kpiLibrary.insert([row]);
    if (error) throw error;
  }

  revalidatePath("/kpi-library");
  redirect("/kpi-library");
}
