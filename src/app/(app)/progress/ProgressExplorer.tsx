"use client";

import { useMemo, useState } from "react";
import type { GroupCard, ProgressData, ProgressKpi } from "@/lib/data/performance-progress";
import { TREND_META, type Status, type Trend } from "@/lib/data/sdbip-status";
import { Sparkline } from "./Sparkline";

type View = "kpi" | "kpa" | "dept";

function cellClasses(status: Status): { bg: string; text: string } {
  if (status === "blue" || status === "met") return { bg: "bg-met-bg/60", text: "text-met" };
  if (status === "almost" || status === "missed") return { bg: "bg-missed-bg/60", text: "text-missed" };
  return { bg: "bg-paper", text: "text-ink2" };
}

function pctColor(pct: number | null): string {
  if (pct == null) return "text-ink2";
  if (pct >= 80) return "text-met";
  if (pct >= 50) return "text-gold";
  return "text-missed";
}

function TrendBadge({ trend }: { trend: Trend }) {
  const meta = TREND_META[trend];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-xs font-bold ${meta.className}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

/**
 * Client-side explorer for the Performance Progress page - three views over
 * the same underlying per-KPI dataset (By KPI table, By KPA cards, By
 * department cards), sharing one search box + department/KPA filters so
 * switching views doesn't lose your place.
 */
export function ProgressExplorer({ data }: { data: ProgressData }) {
  const [view, setView] = useState<View>("kpi");
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [kpaFilter, setKpaFilter] = useState<string | null>(null);

  const depts = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of data.kpis) {
      const key = k.orgCode ?? k.orgName;
      if (key) map.set(key, k.orgName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.kpis]);

  const kpas = useMemo(() => {
    const set = new Set<string>();
    for (const k of data.kpis) if (k.kpa) set.add(k.kpa);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data.kpis]);

  const term = q.trim().toLowerCase();

  const filteredKpis = useMemo(
    () =>
      data.kpis.filter((k) => {
        const deptKey = k.orgCode ?? k.orgName;
        if (deptFilter && deptKey !== deptFilter) return false;
        if (kpaFilter && k.kpa !== kpaFilter) return false;
        if (!term) return true;
        return [k.refCode, k.name, k.kpa].some((f) => f?.toLowerCase().includes(term));
      }),
    [data.kpis, term, deptFilter, kpaFilter]
  );

  const filteredKpaGroups = useMemo(
    () =>
      data.kpaGroups.filter((g) => {
        if (kpaFilter && g.key !== kpaFilter) return false;
        if (!term) return true;
        return g.label.toLowerCase().includes(term);
      }),
    [data.kpaGroups, term, kpaFilter]
  );

  const filteredDeptGroups = useMemo(
    () =>
      data.deptGroups.filter((g) => {
        if (deptFilter && g.key !== deptFilter) return false;
        if (!term) return true;
        return g.label.toLowerCase().includes(term);
      }),
    [data.deptGroups, term, deptFilter]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {(
          [
            ["kpi", "By KPI"],
            ["kpa", "By KPA"],
            ["dept", "By department"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold ${
              view === v ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Search KPIs</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search KPIs…"
            className="w-full min-w-[220px] rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <select
          value={deptFilter ?? ""}
          onChange={(e) => setDeptFilter(e.target.value || null)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
        >
          <option value="">All departments</option>
          {depts.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={kpaFilter ?? ""}
          onChange={(e) => setKpaFilter(e.target.value || null)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
        >
          <option value="">All KPAs</option>
          {kpas.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {view === "kpi" && <KpiTable kpis={filteredKpis} />}
      {view === "kpa" && <GroupCards groups={filteredKpaGroups} />}
      {view === "dept" && <GroupCards groups={filteredDeptGroups} />}
    </div>
  );
}

function KpiTable({ kpis }: { kpis: ProgressKpi[] }) {
  if (kpis.length === 0) return <p className="text-sm text-ink2">No KPIs match these filters.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line bg-ink text-left text-xs font-bold uppercase tracking-wide text-white">
            <th className="px-3 py-2">Ref</th>
            <th className="px-3 py-2">Dept</th>
            <th className="px-3 py-2">Key Performance Indicator</th>
            <th className="px-3 py-2 text-center">Q1</th>
            <th className="px-3 py-2 text-center">Q2</th>
            <th className="px-3 py-2 text-center">Q3</th>
            <th className="px-3 py-2 text-center">Q4</th>
            <th className="px-3 py-2">Direction</th>
            <th className="px-3 py-2">Performance comment</th>
            <th className="px-3 py-2">Corrective measures</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k) => (
            <tr key={k.id} className="border-b border-line align-top last:border-0">
              <td className="px-3 py-2 text-xs text-ink2">{k.refCode ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-ink2">{k.orgCode ?? k.orgName}</td>
              <td className="px-3 py-2 text-ink">{k.name}</td>
              {k.quarters.map((q) => {
                const c = cellClasses(q.status);
                return (
                  <td key={q.quarter} className={`px-3 py-2 text-center ${c.bg}`}>
                    <div className={`font-bold ${c.text}`}>{q.actual || "—"}</div>
                    {q.pctOfTarget != null && (
                      <div className="mt-0.5 text-[10px] text-ink2">{q.pctOfTarget}% of target</div>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2">
                <TrendBadge trend={k.trend} />
              </td>
              <td className="px-3 py-2 text-xs text-ink2">{k.comment ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-ink2">{k.correctiveAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupCards({ groups }: { groups: GroupCard[] }) {
  if (groups.length === 0) return <p className="text-sm text-ink2">No groups match these filters.</p>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.key} className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-bold text-ink">{g.label}</div>
            <div className="flex-none text-xs text-ink2">{g.kpiCount} KPIs</div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <Sparkline values={g.quarterPct} />
            <div className="grid flex-1 grid-cols-4 gap-x-2 text-center">
              {g.quarterPct.map((pct, i) => (
                <div key={i}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-ink2">Q{i + 1}</div>
                  <div className={`text-xs font-bold ${pctColor(pct)}`}>{pct == null ? "—" : `${pct}%`}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <TrendBadge trend={g.trend} />
          </div>
        </div>
      ))}
    </div>
  );
}
