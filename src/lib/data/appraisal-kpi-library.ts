import { createClient } from "@/lib/supabase/server";

/**
 * EPAS-side KPI library data layer - direct sibling of kpi-library.ts (the
 * SDBIP-side library), mirroring the reference tool's mpa/index.html
 * "KPI library" feature (S.lib / pageLibrary()). Unlike kpi_library, this is
 * scoped to a *municipality*-kind org, not a department: the reference
 * tool's library is one flat shared list per municipality, used across
 * every employee regardless of department.
 */

export type AppraisalKpiLibraryItem = {
  id: string;
  orgId: string;
  refCode: string | null;
  kpa: string | null;
  name: string;
  unitOfMeasure: string | null;
  idpRef: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
  c88Code: string | null;
  allocatedEmployeeId: string | null;
  allocatedEmployeeName: string | null;
};

type LibraryRow = {
  id: string;
  org_id: string;
  ref_code: string | null;
  kpa: string | null;
  name: string;
  unit_of_measure: string | null;
  idp_ref: string | null;
  baseline: string | null;
  annual_target: string | null;
  poe: string | null;
  c88_code: string | null;
  allocated_employee_id: string | null;
  allocated_employee: { name: string } | null;
};

const SELECT_COLS =
  "id, org_id, ref_code, kpa, name, unit_of_measure, idp_ref, baseline, annual_target, poe, c88_code, allocated_employee_id, allocated_employee:allocated_employee_id(name)";

function mapRow(r: LibraryRow): AppraisalKpiLibraryItem {
  return {
    id: r.id,
    orgId: r.org_id,
    refCode: r.ref_code,
    kpa: r.kpa,
    name: r.name,
    unitOfMeasure: r.unit_of_measure,
    idpRef: r.idp_ref,
    baseline: r.baseline,
    annualTarget: r.annual_target,
    poe: r.poe,
    c88Code: r.c88_code,
    allocatedEmployeeId: r.allocated_employee_id,
    allocatedEmployeeName: r.allocated_employee?.name ?? null,
  };
}

/** Every indicator in one municipality's EPAS KPI library. */
export async function getAppraisalKpiLibraryList(muniOrgId: string): Promise<AppraisalKpiLibraryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_kpi_library")
    .select(SELECT_COLS)
    .eq("org_id", muniOrgId);
  if (error) throw error;
  return ((data ?? []) as unknown as LibraryRow[]).map(mapRow);
}

export async function getAppraisalKpiLibraryEntry(id: string): Promise<AppraisalKpiLibraryItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_kpi_library")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as LibraryRow | null;
  return row ? mapRow(row) : null;
}

/** Every distinct KPA already in use in this municipality's library, for the form's KPA dropdown. */
export async function getDistinctAppraisalKpas(muniOrgId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appraisal_kpi_library").select("kpa").eq("org_id", muniOrgId).not("kpa", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { kpa: string | null }[];
  const values = new Set(rows.map((r) => r.kpa).filter((v): v is string => !!v && v.trim() !== ""));
  return [...values].sort((a, b) => a.localeCompare(b));
}

export type LibraryEmployee = { id: string; name: string };

/**
 * Every employee under this municipality (any department), for the "allocated
 * to" dropdown and the "add to plan" target picker - matches by ltree path
 * prefix rather than a direct org_id equality, since employees sit on
 * department orgs, not the municipality org itself.
 */
export async function getEmployeesForMunicipality(muniOrgId: string): Promise<LibraryEmployee[]> {
  const supabase = await createClient();
  const { data: muniRow, error: muniErr } = await supabase.from("orgs").select("path").eq("id", muniOrgId).maybeSingle();
  if (muniErr) throw muniErr;
  const muniPath = muniRow ? String((muniRow as unknown as { path: unknown }).path) : null;
  if (!muniPath) return [];

  const { data, error } = await supabase.from("employees").select("id, name, org:orgs(path)").order("name");
  if (error) throw error;
  type Row = { id: string; name: string; org: { path: unknown } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => {
      if (!r.org) return false;
      const p = String(r.org.path);
      return p === muniPath || p.startsWith(`${muniPath}.`);
    })
    .map((r) => ({ id: r.id, name: r.name }));
}

/**
 * The employee's appraisal_cycle for a given financial year, if one already
 * exists - "add to plan" only ever targets an existing cycle (cycles are
 * created by data migration/seeding today, never on the fly by this app).
 */
export async function getAppraisalCycleId(employeeId: string, financialYearId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appraisal_cycles")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("financial_year_id", financialYearId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as { id: string } | null)?.id ?? null;
}
