"use server";

/**
 * Bulk KPI operations for a scorecard: adding KPIs copied from the
 * department's kpi_library, and deleting KPIs that no longer belong. This is
 * the first code in the app that ever writes to scorecard_kpis - previously
 * every row came from a one-off data migration. RLS (sckpi_insert/delete,
 * gated on manage_scorecard_setup) is the real gatekeeper, same as
 * kpi_library's own insert/update policies - this just adds the
 * defense-in-depth checks (org match) a careless client payload shouldn't be
 * able to bypass.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestNextRefCodes } from "@/lib/data/scorecards-shared";

/**
 * Copies one or more kpi_library rows onto a scorecard as new scorecard_kpis
 * rows. Each row carries a permanent kpi_library_id link (so its calc
 * config, method, and answer type stay live-linked to the library
 * definition), and gets a ref code either from the caller (if provided) or
 * auto-suggested by extending the scorecard's existing ref-code pattern.
 * Quarterly targets are intentionally left unset here - they're a separate
 * "scorecard setup" step, not part of placing a KPI on the scorecard.
 */
export async function addLibraryKpisToScorecard(
  scorecardId: string,
  items: { libraryId: string; refCode?: string }[]
): Promise<{ added: number; skipped: string[] }> {
  if (!scorecardId || items.length === 0) return { added: 0, skipped: [] };

  const supabase = await createClient();

  const { data: scorecardRaw, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org_id")
    .eq("id", scorecardId)
    .maybeSingle();
  if (scErr) throw new Error(scErr.message);
  const scorecard = scorecardRaw as unknown as { id: string; org_id: string } | null;
  if (!scorecard) throw new Error("Scorecard not found.");

  const libraryIds = items.map((i) => i.libraryId);
  const { data: libRows, error: libErr } = await supabase
    .from("kpi_library")
    .select("id, org_id, name, kpa, idp_ref, unit_of_measure, target_type")
    .in("id", libraryIds);
  if (libErr) throw new Error(libErr.message);

  type LibRow = {
    id: string;
    org_id: string;
    name: string;
    kpa: string | null;
    idp_ref: string | null;
    unit_of_measure: string | null;
    target_type: string;
  };
  const byId = new Map(((libRows ?? []) as unknown as LibRow[]).map((r) => [r.id, r]));

  const { data: existingKpis, error: exErr } = await supabase
    .from("scorecard_kpis")
    .select("ref_code")
    .eq("scorecard_id", scorecardId);
  if (exErr) throw new Error(exErr.message);
  const existingCodes = ((existingKpis ?? []) as unknown as { ref_code: string | null }[]).map((r) => r.ref_code);

  const needsSuggestion = items.filter((i) => !i.refCode?.trim()).length;
  const suggestions = suggestNextRefCodes(existingCodes, needsSuggestion);
  let suggestionIdx = 0;

  const skipped: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const item of items) {
    const lib = byId.get(item.libraryId);
    if (!lib) {
      skipped.push(item.libraryId);
      continue;
    }
    if (lib.org_id !== scorecard.org_id) {
      skipped.push(lib.name);
      continue;
    }
    const refCode = item.refCode?.trim() || suggestions[suggestionIdx++] || null;
    rows.push({
      scorecard_id: scorecardId,
      kpi_library_id: lib.id,
      ref_code: refCode,
      name: lib.name,
      kpa: lib.kpa,
      idp_ref: lib.idp_ref,
      unit_of_measure: lib.unit_of_measure,
      target_type: lib.target_type,
      weight: 0,
    });
  }

  if (rows.length === 0) return { added: 0, skipped };

  // Cast: same pragmatic workaround used for the kpi_results upsert in
  // scorecards/actions.ts - supabase-js's generic insert() overload
  // resolution doesn't hold up cleanly across postgrest-js versions.
  const { error } = await (
    supabase.from("scorecard_kpis") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    }
  ).insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}`);
  revalidatePath(`/scorecards/${scorecardId}/manage`);

  return { added: rows.length, skipped };
}

/**
 * Deletes one or more KPIs from a scorecard. kpi_targets and kpi_results
 * rows for each are removed automatically (both have ON DELETE CASCADE onto
 * scorecard_kpis), so no manual cleanup is needed - but that also means
 * this is irreversible, which is why the UI confirms before calling it.
 */
export async function deleteScorecardKpis(scorecardId: string, scorecardKpiIds: string[]): Promise<{ deleted: number }> {
  if (!scorecardId || scorecardKpiIds.length === 0) return { deleted: 0 };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("scorecard_kpis")
    .delete({ count: "exact" })
    .eq("scorecard_id", scorecardId)
    .in("id", scorecardKpiIds);
  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}`);
  revalidatePath(`/scorecards/${scorecardId}/manage`);

  return { deleted: count ?? scorecardKpiIds.length };
}
