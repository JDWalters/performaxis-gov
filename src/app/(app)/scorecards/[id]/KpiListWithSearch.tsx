"use client";

import { useMemo, useState } from "react";
import { friendlyActual, type CaptureKpi } from "@/lib/data/scorecards-shared";
import { KpiCaptureCard } from "./KpiCaptureCard";

/**
 * Wraps the KPI capture list with a client-side search box (by ref code,
 * name, or KPA) so capturers on a long department scorecard can jump
 * straight to the KPI they need instead of scrolling the whole list.
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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return kpis;
    return kpis.filter((kpi) =>
      [kpi.refCode, kpi.name, kpi.kpa].some((f) => f?.toLowerCase().includes(term))
    );
  }, [kpis, q]);

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

      {filtered.length === 0 ? (
        <p className="text-sm text-ink2">No KPIs match &quot;{q}&quot;.</p>
      ) : (
        filtered.map((kpi) => (
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
              <div className="flex-none text-xs text-ink2 sm:text-right">
                <div className="font-bold uppercase tracking-wide">Q{quarter} target</div>
                <div className="mt-0.5 font-mono text-sm text-ink">{kpi.target ?? "—"}</div>
              </div>
            </div>

            {canCapture ? (
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
