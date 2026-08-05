"use client";

import { useMemo, useState } from "react";
import { friendlyActual, type CaptureKpi } from "@/lib/data/scorecards-shared";
import { parseNum, statusFor, STATUS_META, type Status } from "@/lib/data/sdbip-status";
import { KpiCaptureCard } from "./KpiCaptureCard";

/** True when a real (non-N/A, non-blank) target exists for this quarter. */
function hasTargetSet(target: string | null): boolean {
  const t = parseNum(target);
  return !t.na && t.num !== null;
}

// Status pill filter order - matches the dashboard's tier ordering.
const STATUS_ORDER: Status[] = ["blue", "met", "almost", "missed", "pending"];

/**
 * Wraps the KPI capture list with client-side search + KPA and
 * achieved/not-achieved filters, so capturers on a long department
 * scorecard can jump straight to the KPIs they need instead of scrolling
 * the whole list.
 */
export function KpiListWithSearch({
  kpis,
  canCapture,
  quarter,
  scorecardId,
}: {
  kpis: CaptureKpi[];
  canCapture: boolean;
  quarter: number;
  scorecardId: string;
}) {
  const [q, setQ] = useState("");
  const [kpaFilter, setKpaFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);

  // Each KPI's saved (last-persisted) status, computed once - reused for
  // both the filter pill counts and the per-card header pill.
  const enriched = useMemo(
    () =>
      kpis.map((kpi) => {
        const hasTarget = hasTargetSet(kpi.target);
        const savedStatus: Status = hasTarget ? statusFor(kpi.result?.actual, kpi.target, kpi.lower) : "pending";
        return { kpi, hasTarget, savedStatus };
      }),
    [kpis]
  );

  const kpas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { kpi } of enriched) {
      if (!kpi.kpa) continue;
      counts.set(kpi.kpa, (counts.get(kpi.kpa) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [enriched]);

  const statusCounts = useMemo(() => {
    const counts = new Map<Status, number>();
    for (const { savedStatus } of enriched) counts.set(savedStatus, (counts.get(savedStatus) ?? 0) + 1);
    return counts;
  }, [enriched]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return enriched.filter(({ kpi, savedStatus }) => {
      if (kpaFilter && kpi.kpa !== kpaFilter) return false;
      if (statusFilter && savedStatus !== statusFilter) return false;
      if (!term) return true;
      return [kpi.refCode, kpi.name, kpi.kpa].some((f) => f?.toLowerCase().includes(term));
    });
  }, [enriched, q, kpaFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative">
        <span className="sr-only">Search KPIs</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by KPI name, ref code, or KPA…"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 sm:max-w-sm"
        />
      </label>

      {kpas.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setKpaFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              kpaFilter === null ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            All KPAs ({kpis.length})
          </button>
          {kpas.map(([kpa, count]) => (
            <button
              key={kpa}
              type="button"
              onClick={() => setKpaFilter(kpaFilter === kpa ? null : kpa)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                kpaFilter === kpa ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              {kpa} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            statusFilter === null ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          All statuses ({kpis.length})
        </button>
        {STATUS_ORDER.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`stag ${STATUS_META[s].tagClass} ${
              statusFilter === s ? "ring-2 ring-ink/40" : ""
            } cursor-pointer text-[11px]`}
          >
            {STATUS_META[s].label} ({statusCounts.get(s)})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink2">
          No KPIs match{q ? ` "${q}"` : ""}
          {kpaFilter ? ` in ${kpaFilter}` : ""}
          {statusFilter ? ` (${STATUS_META[statusFilter].label})` : ""}.
        </p>
      ) : (
        filtered.map(({ kpi, hasTarget, savedStatus }) => (
          <div key={kpi.id} className="rounded-xl border border-line bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {kpi.refCode && <span className="stag stag-pending text-[10px]">{kpi.refCode}</span>}
                  {kpi.kpa && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-ink2">{kpi.kpa}</span>
                  )}
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-ink">{kpi.name}</div>
                {kpi.unitOfMeasure && <div className="mt-0.5 text-xs text-ink2">{kpi.unitOfMeasure}</div>}
              </div>
              <div className="flex flex-none items-center gap-2 text-xs text-ink2 sm:text-right">
                <span>
                  Target Q{quarter}: <span className="font-mono font-bold text-ink">{kpi.target ?? "N/A"}</span>
                </span>
                <span className={`stag ${STATUS_META[savedStatus].tagClass} text-[10px]`}>
                  {STATUS_META[savedStatus].label}
                </span>
              </div>
            </div>

            {!hasTarget ? (
              <div className="rounded-md bg-paper px-3 py-2 text-sm text-ink2">
                No target set for Q{quarter} — nothing to capture this quarter.
              </div>
            ) : canCapture ? (
              <KpiCaptureCard kpi={kpi} quarter={quarter} scorecardId={scorecardId} />
            ) : (
              <div className="text-sm text-ink">{friendlyActual(kpi) ?? "No result captured yet."}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
