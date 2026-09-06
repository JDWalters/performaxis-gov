"use server";

/**
 * "+Year" - the reference tool's createNewYear(): deep-copies every
 * non-empty department scorecard from one financial year into a brand new
 * one. Existing years are never mutated (every write here targets rows
 * under the freshly-inserted financial_years id) - matching the reference's
 * "past years are a frozen record" behaviour. Per KPI, this carries forward
 * everything that describes the indicator (calc/accumulation, KPA, IDP ref,
 * unit, method/type/wards/POE, kpi_library_id for provenance) but:
 *  - overwrites baseline with the outgoing year's own Q4 result (falling
 *    back to the old baseline when Q4 was never captured), since a new
 *    year's baseline is "where we ended up", not "where we started";
 *  - copies quarterly targets only when the admin opts in (they're often
 *    revised year to year, so the default is a clean slate);
 *  - never copies captured results - a new year always starts unreported.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FY_COOKIE } from "@/lib/data/financial-years";

type OutgoingScorecard = { id: string; org_id: string };

type OutgoingKpi = {
  id: string;
  kpi_library_id: string | null;
  ref_code: string | null;
  name: string;
  kpa: string | null;
  idp_ref: string | null;
  weight: number;
  unit_of_measure: string | null;
  target_type: string;
  calc_config: Record<string, unknown> | null;
  method: string | null;
  kpi_type: string | null;
  wards: string | null;
  baseline: string | null;
  annual_target: string | null;
  poe: string | null;
  kpi_targets: { quarter: number; target_value: string | null }[];
  kpi_results: { quarter: number; actual: string | null }[];
};

export async function createNewFinancialYear(formData: FormData) {
  const outgoingFinancialYearId = String(formData.get("outgoingFinancialYearId") ?? "").trim();
  const startYear = Number(formData.get("startYear"));
  const label = String(formData.get("label") ?? "").trim();
  const carryTargets = formData.get("carryTargets") === "on";

  if (!outgoingFinancialYearId || !startYear || !label) {
    throw new Error("Missing financial year details.");
  }

  const supabase = await createClient();

  const { data: outgoingFyRaw, error: fyErr } = await supabase
    .from("financial_years")
    .select("id, org_id")
    .eq("id", outgoingFinancialYearId)
    .maybeSingle();
  if (fyErr) throw new Error(fyErr.message);
  const outgoingFy = outgoingFyRaw as unknown as { id: string; org_id: string } | null;
  if (!outgoingFy) throw new Error("Financial year not found.");

  // Cast: same pragmatic workaround used throughout this data layer for
  // supabase-js's generic insert()/upsert() overload resolution.
  const insertOne = async <T,>(table: string, row: Record<string, unknown>): Promise<T> => {
    const { data, error } = await (
      supabase.from(table) as unknown as {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => { single: () => Promise<{ data: T | null; error: { message: string } | null }> };
        };
      }
    )
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as T;
  };
  const insertMany = async (table: string, rows: Record<string, unknown>[]): Promise<void> => {
    if (rows.length === 0) return;
    const { error } = await (
      supabase.from(table) as unknown as {
        insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
      }
    ).insert(rows);
    if (error) throw new Error(error.message);
  };

  const newFy = await insertOne<{ id: string }>("financial_years", {
    org_id: outgoingFy.org_id,
    start_year: startYear,
    label,
    is_current: false,
  });

  const { data: outgoingScorecardsRaw, error: scErr } = await supabase
    .from("scorecards")
    .select("id, org_id")
    .eq("financial_year_id", outgoingFinancialYearId);
  if (scErr) throw new Error(scErr.message);
  const outgoingScorecards = (outgoingScorecardsRaw ?? []) as unknown as OutgoingScorecard[];

  let scorecardsCopied = 0;
  let kpisCopied = 0;

  for (const oldScorecard of outgoingScorecards) {
    const { data: kpiRowsRaw, error: kpiErr } = await supabase
      .from("scorecard_kpis")
      .select(
        "id, kpi_library_id, ref_code, name, kpa, idp_ref, weight, unit_of_measure, target_type, calc_config, method, kpi_type, wards, baseline, annual_target, poe, kpi_targets(quarter, target_value), kpi_results(quarter, actual)"
      )
      .eq("scorecard_id", oldScorecard.id);
    if (kpiErr) throw new Error(kpiErr.message);
    const oldKpis = (kpiRowsRaw ?? []) as unknown as OutgoingKpi[];
    if (oldKpis.length === 0) continue; // "+Year" only carries forward non-empty scorecards.

    const newScorecard = await insertOne<{ id: string }>("scorecards", {
      org_id: oldScorecard.org_id,
      financial_year_id: newFy.id,
    });
    scorecardsCopied++;

    for (const k of oldKpis) {
      const q4Result = (k.kpi_results ?? []).find((r) => r.quarter === 4);
      const baseline = q4Result?.actual?.trim() ? q4Result.actual : k.baseline;

      const newKpi = await insertOne<{ id: string }>("scorecard_kpis", {
        scorecard_id: newScorecard.id,
        kpi_library_id: k.kpi_library_id,
        ref_code: k.ref_code,
        name: k.name,
        kpa: k.kpa,
        idp_ref: k.idp_ref,
        weight: k.weight ?? 0,
        unit_of_measure: k.unit_of_measure,
        target_type: k.target_type,
        calc_config: k.calc_config ?? {},
        method: k.method,
        kpi_type: k.kpi_type,
        wards: k.wards,
        baseline,
        annual_target: k.annual_target,
        poe: k.poe,
      });
      kpisCopied++;

      if (carryTargets) {
        const targetRows = (k.kpi_targets ?? [])
          .filter((t) => t.target_value !== null && t.target_value !== "")
          .map((t) => ({ scorecard_kpi_id: newKpi.id, quarter: t.quarter, target_value: t.target_value }));
        await insertMany("kpi_targets", targetRows);
      }
      // kpi_results is intentionally never copied - a new year always starts unreported.
    }
  }

  revalidatePath("/scorecards");
  revalidatePath("/progress");
  revalidatePath("/financial-years/new");

  // Switch the creating admin onto the new year immediately - this only
  // sets their own px_fy cookie, not the municipality's is_current flag, so
  // it doesn't change what anyone else defaults to.
  const store = await cookies();
  store.set(FY_COOKIE, newFy.id, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  redirect(`/scorecards?fyCreated=${scorecardsCopied}&fyKpis=${kpisCopied}`);
}
