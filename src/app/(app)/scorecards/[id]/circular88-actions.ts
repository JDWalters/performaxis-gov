"use server";

/**
 * Adds Circular 88 indicators onto a scorecard, and lets a municipality
 * customise ("edit") or reset ("restore") an indicator's own wording. Adding
 * composes with the plain "add from library" mechanism in
 * kpi-admin-actions.ts: a kpi_library row is created first (tagged with
 * c88_code so the KPI carries a permanent link back to its source, mirroring
 * the reference tool's k.c88 field), then placed onto the scorecard exactly
 * like any other library KPI.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addLibraryKpisToScorecard } from "./kpi-admin-actions";
import { getMunicipalityOrgId, getCircular88Catalogue, circular88Calc } from "@/lib/data/circular88";

export async function addCircular88ToScorecard(
  scorecardId: string,
  departmentOrgId: string,
  codes: string[]
): Promise<{ added: number; skipped: string[] }> {
  if (!scorecardId || !departmentOrgId || codes.length === 0) return { added: 0, skipped: [] };

  const supabase = await createClient();
  const municipalityOrgId = await getMunicipalityOrgId(departmentOrgId);
  const catalogue = await getCircular88Catalogue(municipalityOrgId);
  const byCode = new Map(catalogue.map((c) => [c.code, c]));

  const skipped: string[] = [];
  const libraryRows: Record<string, unknown>[] = [];
  for (const code of codes) {
    const indicator = byCode.get(code);
    if (!indicator) {
      skipped.push(code);
      continue;
    }
    libraryRows.push({
      org_id: departmentOrgId,
      name: indicator.indicatorText,
      kpa: indicator.sector,
      method: indicator.method,
      poe: indicator.poe,
      kpi_type: indicator.indicatorType,
      calc_config: { calc: circular88Calc(indicator) },
      c88_code: indicator.code,
    });
  }

  if (libraryRows.length === 0) return { added: 0, skipped };

  // Cast: same pragmatic workaround used for scorecard_kpis insert in
  // kpi-admin-actions.ts.
  const { data: inserted, error } = await (
    supabase.from("kpi_library") as unknown as {
      insert: (
        rows: Record<string, unknown>[]
      ) => { select: (cols: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> };
    }
  )
    .insert(libraryRows)
    .select("id");
  if (error) throw new Error(error.message);

  const newIds = (inserted ?? []).map((r) => r.id);
  const result = await addLibraryKpisToScorecard(
    scorecardId,
    newIds.map((libraryId) => ({ libraryId }))
  );

  revalidatePath(`/scorecards/${scorecardId}`);
  revalidatePath(`/scorecards/${scorecardId}/manage`);

  return { added: result.added, skipped: [...skipped, ...result.skipped] };
}

/**
 * Saves a municipality-level customisation of a Circular 88 indicator's
 * wording/method/POE/etc. Only these narrative/config fields are
 * overridable - list, tier, and frequency stay fixed to the base
 * definition, matching the reference tool's saveC88Edit/c88FromModal.
 */
export async function saveCircular88Override(
  departmentOrgId: string,
  code: string,
  fields: {
    sector?: string;
    indicatorText?: string;
    method?: string;
    poe?: string;
    preset?: string;
    labels?: string[];
    formula?: string;
    accumulation?: string;
    indicatorType?: string;
  }
): Promise<void> {
  const municipalityOrgId = await getMunicipalityOrgId(departmentOrgId);
  if (!municipalityOrgId) throw new Error("Couldn't determine this department's municipality.");

  const supabase = await createClient();
  const overrides: Record<string, unknown> = {};
  if (fields.sector !== undefined) overrides.sector = fields.sector;
  if (fields.indicatorText !== undefined) overrides.indicator_text = fields.indicatorText;
  if (fields.method !== undefined) overrides.method = fields.method;
  if (fields.poe !== undefined) overrides.poe = fields.poe;
  if (fields.preset !== undefined) overrides.preset = fields.preset;
  if (fields.labels !== undefined) overrides.labels = fields.labels;
  if (fields.formula !== undefined) overrides.formula = fields.formula;
  if (fields.accumulation !== undefined) overrides.accumulation = fields.accumulation;
  if (fields.indicatorType !== undefined) overrides.indicator_type = fields.indicatorType;

  const { error } = await (
    supabase.from("circular88_overrides") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ org_id: municipalityOrgId, code, overrides, updated_at: new Date().toISOString() }], {
    onConflict: "org_id,code",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/scorecards");
}

/** Deletes a municipality's override, resetting that indicator back to its standard Circular 88 definition. */
export async function restoreCircular88(departmentOrgId: string, code: string): Promise<void> {
  const municipalityOrgId = await getMunicipalityOrgId(departmentOrgId);
  if (!municipalityOrgId) throw new Error("Couldn't determine this department's municipality.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("circular88_overrides")
    .delete()
    .eq("org_id", municipalityOrgId)
    .eq("code", code);
  if (error) throw new Error(error.message);

  revalidatePath("/scorecards");
}
