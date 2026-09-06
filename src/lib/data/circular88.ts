import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/kpi-calc-shared";

/**
 * MFMA Circular 88 national indicator catalogue - ported from the client's
 * reference tool's hardcoded C88 array (circular88_indicators, seeded once
 * via migration, global/not org-scoped). Municipalities can customise an
 * indicator's wording/method/POE/etc for their own use via
 * circular88_overrides (scoped to the municipality-level org, since the
 * original tool treated the catalogue as shared across every department in
 * one deployment) and later "restore" back to the base definition - the
 * override row is simply deleted, exactly like the reference's
 * sdbip_v4_c88edits diff-map.
 */

export type Circular88Indicator = {
  code: string;
  list: string;
  sector: string;
  indicatorText: string;
  tier: string;
  frequency: string;
  method: string;
  poe: string;
  preset: string;
  labels: string[];
  formula: string;
  accumulation: string;
  indicatorType: string;
  /** True when a municipality-level override exists for this code. */
  edited: boolean;
};

type Circular88Row = {
  code: string;
  list: string;
  sector: string;
  indicator_text: string;
  tier: string;
  frequency: string;
  method: string;
  poe: string;
  preset: string;
  labels: string[];
  formula: string;
  accumulation: string;
  indicator_type: string;
};

type OverrideFields = Partial<{
  sector: string;
  indicator_text: string;
  method: string;
  poe: string;
  preset: string;
  labels: string[];
  formula: string;
  accumulation: string;
  indicator_type: string;
}>;

/**
 * Finds the municipality-level ancestor org for a department, using the
 * ltree path column - C88 wording customisation is muni-wide, not
 * per-department, matching the reference tool's single-shared-catalogue
 * behaviour. Every department's path is exactly one label deeper than its
 * municipality's (e.g. "national.free_state.xhariep.kopanong.fms" under
 * "national.free_state.xhariep.kopanong"), so the ancestor path is just the
 * department's path with its last label dropped - no need for a real ltree
 * ancestor query.
 */
export async function getMunicipalityOrgId(departmentOrgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: deptRow, error: deptErr } = await supabase
    .from("orgs")
    .select("path, kind")
    .eq("id", departmentOrgId)
    .maybeSingle();
  if (deptErr) throw new Error(deptErr.message);
  const dept = deptRow as unknown as { path: string; kind: string } | null;
  if (!dept) return null;
  if (dept.kind === "municipality") return departmentOrgId;

  const segments = dept.path.split(".");
  segments.pop();
  const muniPath = segments.join(".");
  if (!muniPath) return null;

  const { data: muniRow, error: muniErr } = await supabase
    .from("orgs")
    .select("id")
    .eq("path", muniPath)
    .eq("kind", "municipality")
    .maybeSingle();
  if (muniErr) throw new Error(muniErr.message);
  return (muniRow as unknown as { id: string } | null)?.id ?? null;
}

function calcFromPreset(preset: string, labels: string[], formula: string): KpiCalc {
  if (preset === "single") return { type: "single", labels };
  if (preset === "ratioPct") return { type: "ratio", x100: true, labels };
  if (preset === "ratioPlain") return { type: "ratio", labels };
  if (preset === "formula") return { type: "three", formula, labels };
  return { type: "single", labels };
}

/** Derives the same KpiCalc shape used everywhere else in the app from a Circular 88 preset. */
export function circular88Calc(indicator: Pick<Circular88Indicator, "preset" | "labels" | "formula">): KpiCalc {
  return calcFromPreset(indicator.preset, indicator.labels, indicator.formula);
}

/** Every Circular 88 indicator, merged with this municipality's overrides (if any). */
export async function getCircular88Catalogue(municipalityOrgId: string | null): Promise<Circular88Indicator[]> {
  const supabase = await createClient();
  const { data: baseRows, error: baseErr } = await supabase
    .from("circular88_indicators")
    .select("code, list, sector, indicator_text, tier, frequency, method, poe, preset, labels, formula, accumulation, indicator_type")
    .order("code");
  if (baseErr) throw new Error(baseErr.message);

  const overridesByCode = new Map<string, OverrideFields>();
  if (municipalityOrgId) {
    const { data: overrideRows, error: ovErr } = await supabase
      .from("circular88_overrides")
      .select("code, overrides")
      .eq("org_id", municipalityOrgId);
    if (ovErr) throw new Error(ovErr.message);
    for (const row of (overrideRows ?? []) as unknown as { code: string; overrides: OverrideFields }[]) {
      overridesByCode.set(row.code, row.overrides ?? {});
    }
  }

  return ((baseRows ?? []) as unknown as Circular88Row[]).map((r) => {
    const override = overridesByCode.get(r.code);
    return {
      code: r.code,
      list: r.list,
      sector: override?.sector ?? r.sector,
      indicatorText: override?.indicator_text ?? r.indicator_text,
      tier: r.tier,
      frequency: r.frequency,
      method: override?.method ?? r.method,
      poe: override?.poe ?? r.poe,
      preset: override?.preset ?? r.preset,
      labels: override?.labels ?? r.labels,
      formula: override?.formula ?? r.formula,
      accumulation: override?.accumulation ?? r.accumulation,
      indicatorType: override?.indicator_type ?? r.indicator_type,
      edited: Boolean(override),
    };
  });
}

export function getCircular88Sectors(catalogue: Circular88Indicator[]): string[] {
  return [...new Set(catalogue.map((c) => c.sector))].sort((a, b) => a.localeCompare(b));
}
