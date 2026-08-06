/**
 * Types and pure helpers shared between the server data layer (employees.ts)
 * and client components (e.g. EmployeeForm.tsx). Deliberately has no imports
 * from @/lib/supabase/server - that module pulls in next/headers, which
 * breaks the build the moment a client component imports it transitively
 * (same reason scorecards-shared.ts / orgs-shared.ts exist).
 */
import type { Tables } from "@/lib/supabase/types";

export type EmployeeRole = Tables<"employees">["role"];

export const ROLE_LABEL: Record<EmployeeRole, string> = {
  MM: "Municipal Manager (Section 57)",
  DIR: "Director / Manager accountable to the MM (Section 56)",
  STAFF: "Other staff member",
};

/**
 * Who this employee's own performance is assessed against, per the
 * Regulations: the Municipal Manager answers to the Mayor's panel; everyone
 * else accountable to the MM (or general staff) answers to the MM's panel.
 * Mirrors the reference tool's empPanel()/employerTitleFor() logic exactly,
 * except the Mayor's actual name/title comes from the municipality's policy
 * config (per-org, editable in EPAS Setup) instead of being hardcoded.
 */
export function reportsToLabel(role: EmployeeRole): string {
  return role === "MM" ? "the Mayor" : "the Municipal Manager";
}

export type EmployeeRow = {
  id: string;
  name: string;
  position: string | null;
  role: EmployeeRole;
  empno: string | null;
  contract: string | null;
  isActive: boolean;
  orgId: string;
  orgName: string;
  municipalityName: string | null;
};
