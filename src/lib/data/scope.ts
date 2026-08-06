import { cookies } from "next/headers";
import { getMyAccessibleOrgs, type AccessibleOrg } from "@/lib/data/access";

/** Cookie name for the signed-in user's optional "viewing scope". */
export const SCOPE_COOKIE = "px_scope";

export type ActiveScope = {
  org: AccessibleOrg;
  /** The scope org plus every accessible descendant under it (includes the org itself). */
  orgIds: Set<string>;
};

/**
 * The signed-in user's optional "viewing scope" - a subtree of the org
 * hierarchy they've chosen to narrow the rollup screens (Dashboard,
 * Appraisals, Employees, Reports) down to, set by clicking a node in the
 * Dashboard's "Organisations you can see" tree. Purely a display filter
 * layered on top of RLS, never a security boundary of its own: orgIds is
 * always computed from getMyAccessibleOrgs(), so a tampered cookie can only
 * ever narrow what has_org_access/has_employee_access already allow
 * through, never widen it. An org id that isn't (or is no longer) in the
 * caller's accessible set is silently ignored rather than trusted.
 */
export async function getActiveScope(): Promise<ActiveScope | null> {
  const store = await cookies();
  const scopeOrgId = store.get(SCOPE_COOKIE)?.value;
  if (!scopeOrgId) return null;

  const accessible = await getMyAccessibleOrgs();
  const scopeOrg = accessible.find((o) => o.id === scopeOrgId);
  if (!scopeOrg) return null;

  const scopePath = String(scopeOrg.path);
  const orgIds = new Set(
    accessible
      .filter((o) => {
        const p = String(o.path);
        return p === scopePath || p.startsWith(`${scopePath}.`);
      })
      .map((o) => o.id)
  );
  return { org: scopeOrg, orgIds };
}
