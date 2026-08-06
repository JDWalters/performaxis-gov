import { createClient } from "@/lib/supabase/server";
import type { EmployeeRole, EmployeeRow } from "@/lib/data/employees-shared";

export type { EmployeeRole, EmployeeRow } from "@/lib/data/employees-shared";
export { ROLE_LABEL, reportsToLabel } from "@/lib/data/employees-shared";

type EmployeeSelectRow = {
  id: string;
  name: string;
  position: string | null;
  role: EmployeeRole;
  empno: string | null;
  contract: string | null;
  is_active: boolean;
  org: { id: string; name: string; parent: { name: string } | null } | null;
};

/** Every employee the caller can see (RLS: manage_org_setup or view_appraisal_summary on the org, or their own record). */
export async function getEmployees(): Promise<EmployeeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, position, role, empno, contract, is_active, org:orgs(id, name, parent:parent_id(name))")
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as unknown as EmployeeSelectRow[];
  return rows
    .filter((r) => r.org)
    .map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      role: r.role,
      empno: r.empno,
      contract: r.contract,
      isActive: r.is_active,
      orgId: r.org!.id,
      orgName: r.org!.name,
      municipalityName: r.org!.parent?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEmployee(id: string): Promise<EmployeeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, position, role, empno, contract, is_active, org:orgs(id, name, parent:parent_id(name))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const r = data as unknown as EmployeeSelectRow | null;
  if (!r || !r.org) return null;
  return {
    id: r.id,
    name: r.name,
    position: r.position,
    role: r.role,
    empno: r.empno,
    contract: r.contract,
    isActive: r.is_active,
    orgId: r.org.id,
    orgName: r.org.name,
    municipalityName: r.org.parent?.name ?? null,
  };
}
