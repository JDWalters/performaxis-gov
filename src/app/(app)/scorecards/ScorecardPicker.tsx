"use client";

import { useRouter } from "next/navigation";
import type { ScorecardOption } from "@/lib/data/sdbip-dashboard";

export function ScorecardPicker({
  options,
  selectedId,
  periodKey,
}: {
  options: ScorecardOption[];
  selectedId: string;
  periodKey: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={selectedId}
      onChange={(e) => router.push(`/scorecards?sc=${e.target.value}&period=${periodKey}`)}
      className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
