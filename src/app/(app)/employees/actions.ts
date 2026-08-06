"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeRole } from "@/lib/data/employees-shared";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Creates or updates one employee record. Employees are always attached to
 * a department org (even the Municipal Manager - see "Office of the
 * Municipal Manager" in the seeded data), never to the municipality or a
 * higher level directly, matching how the rest of the app scopes
 * appraisals/scorecards. RLS (employees_insert/employees_update, via
 * has_org_access "manage_org_setup") re-checks permission on whichever
 * department org is submitted.
 */
export async function saveEmployee(formData: FormData) {
  const id = str(formData, "id");
  const name = str(formData, "name");
  const position = str(formData, "position");
  const role = str(formData, "role") as EmployeeRole;
  const orgId = str(formData, "orgId");
  const empno = str(formData, "empno");
  const contract = str(formData, "contract");

  if (!name || !orgId || !role) throw new Error("Name, department, and role are all required.");

  const supabase = await createClient();
  const row = {
    name,
    position: position || null,
    role,
    org_id: orgId,
    empno: empno || null,
    contract: contract || null,
  };

  if (id) {
    // Cast: same pragmatic workaround used throughout this codebase - the
    // generic update() overload doesn't always resolve cleanly against the
    // generated Functions/Tables map across postgrest-js versions.
    const employeesTable = supabase.from("employees") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await employeesTable.update(row).eq("id", id);
    if (error) throw error;
  } else {
    const employeesTable = supabase.from("employees") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await employeesTable.insert([row]);
    if (error) throw error;
  }

  revalidatePath("/employees");
}

/**
 * Toggles is_active rather than hard-deleting - an employee's appraisal
 * history (cycles/KPIs/ratings) cascades on hard delete at the DB level, so
 * "removing" someone who has any appraisal history must deactivate them
 * (hides them from new-cycle pickers, keeps every past record intact) not
 * destroy their record.
 */
export async function setEmployeeActive(formData: FormData) {
  const id = str(formData, "id");
  const isActive = formData.get("isActive") === "1";
  if (!id) throw new Error("Missing employee.");

  const supabase = await createClient();
  const employeesTable = supabase.from("employees") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await employeesTable.update({ is_active: isActive }).eq("id", id);
  if (error) throw error;

  revalidatePath("/employees");
}
