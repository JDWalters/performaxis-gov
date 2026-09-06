"use client";

import { useRouter } from "next/navigation";
import type { ScorecardOption } from "@/lib/data/sdbip-dashboard";

/**
 * Lets the signed-in user jump straight to another department's scorecard
 * from the detail page, instead of going back to "All scorecards" first.
 * Direct sibling of scorecards/ScorecardPicker.tsx (the dashboard's picker),
 * but redirects within the detail page (/scorecards/[id]) and preserves the
 * current period instead of the dashboard's ?sc=/&period= pair.
 */
export function DepartmentPicker({
  options,
  selectedId,
  periodParam,
}: {
  options: ScorecardOption[];
  selectedId: string;
  periodParam: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={selectedId}
      onChange={(e) => router.push(`/scorecards/${e.target.value}?q=${periodParam}`)}
      className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.orgName ?? o.label}
        </option>
      ))}
    </select>
  );
}
