"use client";

import { useRouter } from "next/navigation";
import type { ScorecardOption } from "@/lib/data/performance-progress";

export function ProgressScorecardPicker({
  options,
  selectedId,
}: {
  options: ScorecardOption[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 rounded-xl border-l-4 border-gold bg-white px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-ink2">Scorecard</span>
      <select
        defaultValue={selectedId}
        onChange={(e) => router.push(`/progress?sc=${e.target.value}`)}
        className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
