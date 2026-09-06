"use client";

import { useMemo, useState, useTransition } from "react";
import { addLibraryKpisToScorecard, deleteScorecardKpis } from "../kpi-admin-actions";
import { Circular88Section, type Circular88Indicator } from "./Circular88Section";

type CurrentKpi = { id: string; refCode: string | null; name: string; kpa: string | null; c88Code: string | null };
type LibraryKpi = {
  id: string;
  name: string;
  kpa: string | null;
  unitOfMeasure: string | null;
  targetType: string;
  alreadyOnScorecard: boolean;
};

export function ManageKpisClient({
  scorecardId,
  departmentOrgId,
  currentKpis,
  availableLibrary,
  circular88Catalogue,
}: {
  scorecardId: string;
  departmentOrgId: string;
  currentKpis: CurrentKpi[];
  availableLibrary: LibraryKpi[];
  circular88Catalogue: Circular88Indicator[];
}) {
  const [deleteChecked, setDeleteChecked] = useState<Record<string, boolean>>({});
  const [addChecked, setAddChecked] = useState<Record<string, boolean>>({});
  const [refCodes, setRefCodes] = useState<Record<string, string>>({});
  const [libSearch, setLibSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const deleteCount = Object.values(deleteChecked).filter(Boolean).length;
  const addCount = Object.values(addChecked).filter(Boolean).length;

  const filteredLibrary = useMemo(() => {
    const term = libSearch.trim().toLowerCase();
    if (!term) return availableLibrary;
    return availableLibrary.filter((k) => [k.name, k.kpa].some((f) => f?.toLowerCase().includes(term)));
  }, [availableLibrary, libSearch]);

  function handleDelete() {
    const ids = Object.entries(deleteChecked)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} KPI${ids.length === 1 ? "" : "s"}? This also removes all captured targets and results for ${ids.length === 1 ? "it" : "them"} - this can't be undone.`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await deleteScorecardKpis(scorecardId, ids);
        setMessage(`Deleted ${res.deleted} KPI${res.deleted === 1 ? "" : "s"}.`);
        setDeleteChecked({});
      } catch {
        setMessage("Couldn't delete - check your connection and try again.");
      }
    });
  }

  function handleAdd() {
    const items = Object.entries(addChecked)
      .filter(([, v]) => v)
      .map(([libraryId]) => ({ libraryId, refCode: refCodes[libraryId]?.trim() || undefined }));
    if (items.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await addLibraryKpisToScorecard(scorecardId, items);
        setMessage(
          `Added ${res.added} KPI${res.added === 1 ? "" : "s"}.` +
            (res.skipped.length ? ` Skipped: ${res.skipped.join(", ")}.` : "")
        );
        setAddChecked({});
        setRefCodes({});
      } catch {
        setMessage("Couldn't add - check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {message && (
        <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink">{message}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Current KPIs on this scorecard ({currentKpis.length})</h2>
        {currentKpis.length === 0 ? (
          <p className="text-sm text-ink2">No KPIs on this scorecard yet - add some from the library below.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-[11px] font-bold uppercase text-ink2">
                  <th className="px-3 py-2">Remove</th>
                  <th className="px-3 py-2">Ref</th>
                  <th className="px-3 py-2">KPI</th>
                  <th className="px-3 py-2">KPA</th>
                </tr>
              </thead>
              <tbody>
                {currentKpis.map((k) => (
                  <tr key={k.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={Boolean(deleteChecked[k.id])}
                        onChange={(e) => setDeleteChecked((prev) => ({ ...prev, [k.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs text-ink2">{k.refCode ?? "—"}</td>
                    <td className="px-3 py-2 align-top text-ink">
                      {k.c88Code && (
                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue">C88: {k.c88Code}</div>
                      )}
                      {k.name}
                    </td>
                    <td className="px-3 py-2 align-top text-ink2">{k.kpa ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending || deleteCount === 0}
          className="w-fit rounded-md border border-missed bg-white px-3 py-1.5 text-xs font-bold text-missed hover:bg-missed-bg disabled:opacity-50"
        >
          {pending ? "Working…" : `Delete ${deleteCount} selected`}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Add from this department&apos;s library ({availableLibrary.length})</h2>
        <input
          type="search"
          value={libSearch}
          onChange={(e) => setLibSearch(e.target.value)}
          placeholder="Search library KPIs…"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 sm:max-w-sm"
        />
        {filteredLibrary.length === 0 ? (
          <p className="text-sm text-ink2">No matching library KPIs.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-[11px] font-bold uppercase text-ink2">
                  <th className="px-3 py-2">Add</th>
                  <th className="px-3 py-2">KPI</th>
                  <th className="px-3 py-2">KPA</th>
                  <th className="px-3 py-2">Ref code</th>
                </tr>
              </thead>
              <tbody>
                {filteredLibrary.map((k) => (
                  <tr key={k.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        disabled={k.alreadyOnScorecard}
                        checked={Boolean(addChecked[k.id])}
                        onChange={(e) => setAddChecked((prev) => ({ ...prev, [k.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-ink">{k.name}</div>
                      {k.alreadyOnScorecard && (
                        <div className="text-[11px] font-semibold text-ink2">Already on this scorecard</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-ink2">{k.kpa ?? "—"}</td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="text"
                        placeholder="auto"
                        disabled={k.alreadyOnScorecard}
                        value={refCodes[k.id] ?? ""}
                        onChange={(e) => setRefCodes((prev) => ({ ...prev, [k.id]: e.target.value }))}
                        className="w-24 rounded-md border border-line px-2 py-1 font-mono text-xs text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || addCount === 0}
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Working…" : `Add ${addCount} selected`}
        </button>
      </section>

      <Circular88Section
        scorecardId={scorecardId}
        departmentOrgId={departmentOrgId}
        catalogue={circular88Catalogue}
        usedCodes={new Set(currentKpis.map((k) => k.c88Code).filter((c): c is string => Boolean(c)))}
      />
    </div>
  );
}
