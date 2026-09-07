"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { AppraisalKpiLibraryItem, LibraryEmployee } from "@/lib/data/appraisal-kpi-library";
import { addLibraryEntriesToPlan, bulkDeleteAppraisalKpiLibraryEntries, deleteAppraisalKpiLibraryEntry } from "./actions";

type SortMode = "kpa" | "person" | "ref";

/**
 * The EPAS KPI library's main list - search, sort (KPA / person allocated to
 * / reference), bulk-select + "Add selected to {employee}'s plan", and
 * per-row add/edit/delete. Mirrors the reference tool's pageLibrary() (see
 * mpa/index.html), adapted to this app's dedicated-page (not modal)
 * create/edit convention already used by the SDBIP KPI Type Generator.
 */
export function EpasKpiLibraryTable({
  orgId,
  kpis,
  employees,
  financialYearId,
}: {
  orgId: string;
  kpis: AppraisalKpiLibraryItem[];
  employees: LibraryEmployee[];
  financialYearId: string | null;
}) {
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("kpa");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetEmployeeId, setTargetEmployeeId] = useState(employees[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return kpis;
    return kpis.filter((k) =>
      [k.refCode, k.name, k.unitOfMeasure, k.kpa, k.c88Code, k.allocatedEmployeeName].some((f) =>
        f?.toLowerCase().includes(term)
      )
    );
  }, [kpis, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "person") {
      arr.sort((a, b) => {
        const an = a.allocatedEmployeeName ?? "";
        const bn = b.allocatedEmployeeName ?? "";
        if (!an && bn) return 1;
        if (an && !bn) return -1;
        if (an !== bn) return an.localeCompare(bn);
        return (a.refCode ?? "").localeCompare(b.refCode ?? "", undefined, { numeric: true });
      });
    } else if (sortMode === "ref") {
      arr.sort((a, b) => (a.refCode ?? "").localeCompare(b.refCode ?? "", undefined, { numeric: true }));
    } else {
      arr.sort((a, b) => (a.kpa ?? "").localeCompare(b.kpa ?? "") || (a.refCode ?? "").localeCompare(b.refCode ?? "", undefined, { numeric: true }));
    }
    return arr;
  }, [filtered, sortMode]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === sorted.length ? new Set() : new Set(sorted.map((k) => k.id))));
  }

  function addToPlan(ids: string[]) {
    if (!targetEmployeeId) {
      setMsg("Select an employee first — the indicator is added to that employee's performance plan.");
      return;
    }
    if (!financialYearId) {
      setMsg("Switch to a financial year for this municipality first (top-right FY switcher).");
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set("employeeId", targetEmployeeId);
    fd.set("financialYearId", financialYearId);
    ids.forEach((id) => fd.append("ids", id));
    startTransition(() => {
      addLibraryEntriesToPlan(fd)
        .then(({ added, skipped }) => {
          setSelected(new Set());
          setMsg(
            added
              ? `Added ${added} indicator${added > 1 ? "s" : ""} to ${targetEmployeeName}'s plan${skipped ? ` — ${skipped} already there and skipped.` : ". The weightings have been re-balanced."}`
              : "Those indicators are already in this plan."
          );
        })
        .catch((err) => setMsg(err instanceof Error ? err.message : "Couldn't add to plan."));
    });
  }

  function deleteOne(id: string, label: string) {
    if (!confirm(`Remove "${label}" from the KPI library?\n\nPerformance plans that already use it are not affected.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("orgId", orgId);
    startTransition(() => deleteAppraisalKpiLibraryEntry(fd));
  }

  function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Remove ${selected.size} indicator${selected.size > 1 ? "s" : ""} from the KPI library?\n\nPerformance plans that already use them are not affected.`)) return;
    const fd = new FormData();
    fd.set("orgId", orgId);
    selected.forEach((id) => fd.append("ids", id));
    startTransition(() => bulkDeleteAppraisalKpiLibraryEntries(fd));
    setSelected(new Set());
  }

  const targetEmployeeName = employees.find((e) => e.id === targetEmployeeId)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search indicators</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search indicators…"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 sm:max-w-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
          Sort by
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          >
            <option value="kpa">KPA</option>
            <option value="person">Person allocated to</option>
            <option value="ref">Reference</option>
          </select>
        </label>
        <span className="text-xs text-ink2">
          {sorted.length} of {kpis.length}
        </span>
      </div>

      {msg && <div className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">{msg}</div>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink2">
          <input type="checkbox" checked={selected.size > 0 && selected.size === sorted.length} onChange={toggleAll} />
          Select all shown
        </label>
        <select
          value={targetEmployeeId}
          onChange={(e) => setTargetEmployeeId(e.target.value)}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
        >
          {employees.length === 0 && <option value="">No employees yet</option>}
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || selected.size === 0}
          onClick={() => addToPlan([...selected])}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-40"
        >
          Add selected ({selected.size}) to {targetEmployeeName}&apos;s plan
        </button>
        <button
          type="button"
          disabled={isPending || selected.size === 0}
          onClick={deleteSelected}
          className="rounded-md border border-missed px-3 py-1.5 text-xs font-bold text-missed hover:bg-missed-bg disabled:opacity-40"
        >
          Delete selected
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-6 text-center text-sm text-ink2">
          {kpis.length ? "Nothing matches your search." : "Create your first indicator for the library."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">KPA</th>
                <th className="px-3 py-2">Indicator</th>
                <th className="px-3 py-2">Unit of measure</th>
                <th className="px-3 py-2">Annual target</th>
                <th className="px-3 py-2">Allocated to</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => (
                <tr key={k.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(k.id)} onChange={() => toggle(k.id)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink2">
                    {k.refCode || "—"}
                    {k.c88Code && <div className="mt-0.5 text-[10px] text-ink2">C88: {k.c88Code}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="stag stag-blue">{k.kpa || "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-ink">{k.name}</td>
                  <td className="px-3 py-2 text-ink2">{k.unitOfMeasure || "—"}</td>
                  <td className="px-3 py-2 text-ink2">{k.annualTarget || "—"}</td>
                  <td className="px-3 py-2 text-ink2">{k.allocatedEmployeeName || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => addToPlan([k.id])}
                        className="text-xs font-semibold text-blue hover:underline disabled:opacity-40"
                      >
                        Add to plan
                      </button>
                      <Link href={`/epas-kpi-library/${k.id}`} prefetch={false} className="text-xs font-semibold text-ink2 hover:text-ink hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => deleteOne(k.id, k.name)}
                        className="text-xs font-semibold text-missed hover:underline disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
