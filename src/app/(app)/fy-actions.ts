"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FY_COOKIE } from "@/lib/data/financial-years";

/**
 * Sets the active financial year (see src/lib/data/financial-years.ts) and
 * returns to a safe list page rather than the calling scorecard/appraisal
 * detail page - a specific scorecard id is one year's row, so it usually
 * doesn't exist under the newly-selected year, and redirecting to it would
 * 404. Once a real per-year "same department, different year" lookup exists
 * (see task #152's +Year rollover), this can get smarter about staying on
 * the equivalent page.
 */
export async function setFinancialYear(formData: FormData) {
  const fyId = String(formData.get("fyId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/scorecards");
  if (fyId) {
    const store = await cookies();
    store.set(FY_COOKIE, fyId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(returnTo);
}
