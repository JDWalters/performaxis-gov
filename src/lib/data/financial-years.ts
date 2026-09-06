import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyAccessibleOrgs } from "@/lib/data/access";

/** Cookie name for the signed-in user's selected financial year (see getActiveFinancialYear). */
export const FY_COOKIE = "px_fy";

export type FinancialYear = {
  id: string;
  orgId: string;
  startYear: number;
  label: string;
  isCurrent: boolean;
};

type FyRow = { id: string; org_id: string; start_year: number; label: string; is_current: boolean };

/**
 * Financial years are one shared list per municipality (financial_years.org_id
 * is the municipality-kind org, never a department) - matching the reference
 * tool's single global FY switcher shared by every department's scorecard.
 * Reuses the same "municipality-kind ancestor" concept as
 * circular88.ts:getMunicipalityOrgId, but here we only need orgs the
 * signed-in user can already see, so it's cheaper to filter their accessible
 * set than to walk ltree paths.
 */
export async function getMyMunicipalityOrgs(): Promise<{ id: string; name: string }[]> {
  const accessible = await getMyAccessibleOrgs();
  return accessible.filter((o) => o.kind === "municipality").map((o) => ({ id: o.id, name: o.name }));
}

export type ActiveFinancialYear = {
  /** The municipality this FY list belongs to - null if the signed-in user has no municipality-level org yet. */
  muniOrgId: string | null;
  years: FinancialYear[];
  /** The currently-selected year, resolved from (in order) the px_fy cookie, the DB's is_current flag, or the most recent year - null only when the municipality has no financial years at all yet. */
  selected: FinancialYear | null;
};

/**
 * The signed-in user's active financial year and the full list to switch
 * between, for the shared topbar FY selector. Mirrors getActiveScope()'s
 * cookie-narrows-never-widens pattern: a stale or tampered px_fy cookie value
 * that isn't actually one of this municipality's financial years is silently
 * ignored rather than trusted, falling back to is_current or the latest year.
 */
export async function getActiveFinancialYear(): Promise<ActiveFinancialYear> {
  const munis = await getMyMunicipalityOrgs();
  const muniOrgId = munis[0]?.id ?? null;
  if (!muniOrgId) return { muniOrgId: null, years: [], selected: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_years")
    .select("id, org_id, start_year, label, is_current")
    .eq("org_id", muniOrgId)
    .order("start_year");
  if (error) throw error;

  const years: FinancialYear[] = ((data ?? []) as unknown as FyRow[]).map((r) => ({
    id: r.id,
    orgId: r.org_id,
    startYear: r.start_year,
    label: r.label,
    isCurrent: r.is_current,
  }));

  const store = await cookies();
  const cookieId = store.get(FY_COOKIE)?.value;
  const selected =
    years.find((y) => y.id === cookieId) ?? years.find((y) => y.isCurrent) ?? years[years.length - 1] ?? null;

  return { muniOrgId, years, selected };
}
