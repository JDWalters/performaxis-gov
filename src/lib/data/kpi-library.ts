import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/kpi-calc-shared";

export type { KpiCalc } from "@/lib/data/kpi-calc-shared";

export type DepartmentOrg = { id: string; name: string; municipalityName: string | null };

type DepartmentOrgRow = { id: string; name: string; parent: { name: string } | null };

/**
 * Every department a policy writer can assign a KPI type to, across every
 * municipality the caller can see (RLS-scoped via has_any_org_access, same
 * as everywhere else). Includes the parent municipality's name so the
 * dropdown stays unambiguous once a second municipality's departments
 * exist - "Financial Services" alone was fine with only Kopanong on the
 * platform, but won't be once there's a second one.
 */
export async function getDepartmentOrgs(): Promise<DepartmentOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, name, parent:parent_id(name)")
    .eq("kind", "department")
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as unknown as DepartmentOrgRow[];
  return rows
    .map((r) => ({ id: r.id, name: r.name, municipalityName: r.parent?.name ?? null }))
    .sort((a, b) => (a.municipalityName ?? "").localeCompare(b.municipalityName ?? "") || a.name.localeCompare(b.name));
}

/** Every distinct KPA name already in use, for the KPI form's KPA dropdown - avoids typo'd near-duplicates like "BSD" vs "B.S.D.". */
export async function getDistinctKpas(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("kpi_library").select("kpa").not("kpa", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { kpa: string | null }[];
  const values = new Set(rows.map((r) => r.kpa).filter((v): v is string => !!v && v.trim() !== ""));
  return [...values].sort((a, b) => a.localeCompare(b));
}

export type KpiLibraryItem = {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  description: string | null;
  kpa: string | null;
  idpRef: string | null;
  unitOfMeasure: string | null;
  targetType: string;
  calc: KpiCalc | null;
};

type KpiLibraryRow = {
  id: string;
  name: string;
  description: string | null;
  kpa: string | null;
  idp_ref: string | null;
  unit_of_measure: string | null;
  target_type: string;
  calc_config: { calc?: KpiCalc } | null;
  org: { id: string; name: string } | null;
};

/** Every KPI type definition the policy writer has authored, grouped by department in the UI. */
export async function getKpiLibraryList(): Promise<KpiLibraryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_library")
    .select(
      "id, name, description, kpa, idp_ref, unit_of_measure, target_type, calc_config, org:orgs(id, name)"
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as KpiLibraryRow[];
  return rows
    .filter((r) => r.org)
    .map((r) => ({
      id: r.id,
      orgId: r.org!.id,
      orgName: r.org!.name,
      name: r.name,
      description: r.description,
      kpa: r.kpa,
      idpRef: r.idp_ref,
      unitOfMeasure: r.unit_of_measure,
      targetType: r.target_type,
      calc: r.calc_config?.calc ?? null,
    }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName) || a.name.localeCompare(b.name));
}

export async function getKpiLibraryEntry(id: string): Promise<KpiLibraryItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_library")
    .select(
      "id, name, description, kpa, idp_ref, unit_of_measure, target_type, calc_config, org:orgs(id, name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  const row = data as unknown as KpiLibraryRow | null;
  if (!row || !row.org) return null;

  return {
    id: row.id,
    orgId: row.org.id,
    orgName: row.org.name,
    name: row.name,
    description: row.description,
    kpa: row.kpa,
    idpRef: row.idp_ref,
    unitOfMeasure: row.unit_of_measure,
    targetType: row.target_type,
    calc: row.calc_config?.calc ?? null,
  };
}
