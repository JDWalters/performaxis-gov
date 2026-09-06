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

/**
 * Whether the signed-in user can create a new financial year for this
 * municipality - gated on manage_org_setup (the financial_years table's own
 * RLS insert policy), not manage_scorecard_setup, since a financial year is
 * an org-level concern shared across every department. In practice every
 * role that has manage_scorecard_setup also has manage_org_setup (Municipal
 * Admin, Platform Admin), so whoever can create the year can also write the
 * copied scorecards that "+Year" creates underneath it.
 */
export async function canManageFinancialYears(muniOrgId: string | null): Promise<boolean> {
  if (!muniOrgId) return false;
  const supabase = await createClient();
  // Cast must stay a single member-expression call - see the `this`-binding
  // note in scorecards.ts/users.ts/orgs.ts. Assigning `supabase.rpc` to a
  // variable first strips its binding to the client and throws at runtime.
  const { data } = await (
    supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>
  )("has_org_access", { target_org_id: muniOrgId, required_permission: "manage_org_setup" });
  return Boolean(data);
}

/**
 * Suggests the next financial year's start_year/label by extending the
 * latest existing year by one (e.g. latest "2026/27" -> suggests
 * start_year 2027, label "2027/28"). Falls back to the current calendar
 * year when the municipality has no financial years yet.
 */
export function suggestNextFinancialYear(years: FinancialYear[]): { startYear: number; label: string } {
  const latest = years.length > 0 ? Math.max(...years.map((y) => y.startYear)) : new Date().getFullYear();
  const startYear = years.length > 0 ? latest + 1 : latest;
  const label = `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
  return { startYear, label };
}

export type RolloverPreviewRow = { orgId: string; orgName: string; kpiCount: number };

/**
 * Every non-empty department scorecard under one financial year, with its
 * KPI count - shown on the "+Year" screen so the admin can see exactly what
 * "+Year" is about to copy before they commit to it. A scorecard with zero
 * KPIs is skipped here and by the rollover itself, matching the reference
 * tool's "only non-empty scorecards get copied forward" behaviour.
 */
export async function getRolloverPreview(financialYearId: string): Promise<RolloverPreviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scorecards")
    .select("org:orgs(id, name), scorecard_kpis(id)")
    .eq("financial_year_id", financialYearId);
  if (error) throw error;

  type Row = { org: { id: string; name: string } | null; scorecard_kpis: { id: string }[] };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.org && (r.scorecard_kpis ?? []).length > 0)
    .map((r) => ({ orgId: r.org!.id, orgName: r.org!.name, kpiCount: r.scorecard_kpis.length }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
}
