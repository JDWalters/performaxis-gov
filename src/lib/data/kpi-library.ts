import { createClient } from "@/lib/supabase/server";
import type { KpiCalc } from "@/lib/data/kpi-calc-shared";

export type { KpiCalc } from "@/lib/data/kpi-calc-shared";

export type DepartmentOrg = { id: string; name: string };

/** The 5 Kopanong departments - the only orgs a policy writer assigns a KPI type to. */
export async function getDepartmentOrgs(): Promise<DepartmentOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("kind", "department")
    .order("name");
  if (error) throw error;
  return (data ?? []) as DepartmentOrg[];
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
