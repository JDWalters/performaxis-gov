"use client";

import { useRef } from "react";
import { setFinancialYear } from "@/app/(app)/fy-actions";
import type { FinancialYear } from "@/lib/data/financial-years";

/**
 * The shared topbar financial-year selector (present on every page, per the
 * reference tool's global FY switcher) - changing it sets the px_fy cookie
 * via a server action and reloads onto a safe list page. Renders nothing
 * when the signed-in user has no municipality-level org yet (getActiveFinancialYear
 * returns an empty list in that case) - there's nothing to switch between.
 */
export function FinancialYearSwitcher({ years, selectedId }: { years: FinancialYear[]; selectedId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);

  if (years.length === 0) return null;

  return (
    <form ref={formRef} action={setFinancialYear} className="flex items-center gap-1.5">
      <input type="hidden" name="returnTo" value="/scorecards" />
      <label htmlFor="fy-switcher" className="text-[10px] font-bold uppercase tracking-wide text-ink2">
        FY
      </label>
      <select
        id="fy-switcher"
        name="fyId"
        value={selectedId ?? undefined}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-ink"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.label}
            {y.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
