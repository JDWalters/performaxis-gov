"use client";

import { useMemo, useState, useTransition } from "react";
import { addCircular88ToScorecard, saveCircular88Override, restoreCircular88 } from "../circular88-actions";

export type Circular88Indicator = {
  code: string;
  list: string;
  sector: string;
  indicatorText: string;
  tier: string;
  frequency: string;
  method: string;
  poe: string;
  preset: string;
  labels: string[];
  formula: string;
  accumulation: string;
  indicatorType: string;
  edited: boolean;
};

const LIST_LABELS: Record<string, string> = {
  A: "Quarterly outputs",
  B: "Annual outputs",
  C: "Annual outcomes",
};

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1 text-xs text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type EditState = {
  indicatorText: string;
  method: string;
  poe: string;
  sector: string;
  indicatorType: string;
  accumulation: string;
};

function toEditState(ind: Circular88Indicator): EditState {
  return {
    indicatorText: ind.indicatorText,
    method: ind.method,
    poe: ind.poe,
    sector: ind.sector,
    indicatorType: ind.indicatorType,
    accumulation: ind.accumulation,
  };
}

/**
 * National Circular 88 indicator picker: search/filter, bulk-add onto the
 * scorecard (via kpi_library + scorecard_kpis, tagged with c88_code), and
 * per-indicator edit/restore of a municipality's own wording override -
 * mirroring the reference tool's library tab + saveC88Edit/c88-restore, but
 * scoped per-municipality via circular88_overrides instead of a single
 * shared KV diff.
 */
export function Circular88Section({
  scorecardId,
  departmentOrgId,
  catalogue,
  usedCodes,
}: {
  scorecardId: string;
  departmentOrgId: string;
  catalogue: Circular88Indicator[];
  usedCodes: Set<string>;
}) {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string>("All sectors");
  const [list, setList] = useState<string>("All");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const sectors = useMemo(() => ["All sectors", ...new Set(catalogue.map((c) => c.sector))].sort(), [catalogue]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalogue.filter((c) => {
      if (sector !== "All sectors" && c.sector !== sector) return false;
      if (list !== "All" && c.list !== list) return false;
      if (!term) return true;
      return `${c.code} ${c.indicatorText} ${c.sector}`.toLowerCase().includes(term);
    });
  }, [catalogue, search, sector, list]);

  const checkedCount = Object.values(checked).filter(Boolean).length;

  function handleAdd() {
    const codes = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([code]) => code);
    if (codes.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await addCircular88ToScorecard(scorecardId, departmentOrgId, codes);
        setMessage(
          `Added ${res.added} indicator${res.added === 1 ? "" : "s"}.` +
            (res.skipped.length ? ` Skipped: ${res.skipped.join(", ")}.` : "")
        );
        setChecked({});
      } catch {
        setMessage("Couldn't add - check your connection and try again.");
      }
    });
  }

  function startEdit(ind: Circular88Indicator) {
    setEditingCode(ind.code);
    setEditState(toEditState(ind));
  }

  function saveEdit() {
    if (!editingCode || !editState) return;
    startTransition(async () => {
      try {
        await saveCircular88Override(departmentOrgId, editingCode, {
          indicatorText: editState.indicatorText,
          method: editState.method,
          poe: editState.poe,
          sector: editState.sector,
          indicatorType: editState.indicatorType,
          accumulation: editState.accumulation,
        });
        setMessage(`Saved changes to ${editingCode}.`);
        setEditingCode(null);
        setEditState(null);
      } catch {
        setMessage("Couldn't save - check your connection and try again.");
      }
    });
  }

  function handleRestore(code: string) {
    if (!window.confirm(`Restore Circular 88 indicator ${code} to its standard definition? Your changes to it will be removed.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await restoreCircular88(departmentOrgId, code);
        setMessage(`Restored ${code} to its standard definition.`);
      } catch {
        setMessage("Couldn't restore - check your connection and try again.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-ink">
        Add from Circular 88 (National Treasury indicator catalogue) ({catalogue.length})
      </h2>
      <p className="text-xs text-ink2">
        Standard indicators every municipality is expected to draw from. Editing an indicator&apos;s wording here
        applies to your whole municipality, not just this department, and can be restored to the national
        definition at any time.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Circular 88 indicators…"
          className="min-w-[200px] flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={list}
          onChange={(e) => setList(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="All">All lists</option>
          <option value="A">Quarterly outputs</option>
          <option value="B">Annual outputs</option>
          <option value="C">Annual outcomes</option>
        </select>
      </div>

      {message && (
        <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink">{message}</p>
      )}

      <div className="text-xs text-ink2">
        {filtered.length} of {catalogue.length}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((ind) => {
          const already = usedCodes.has(ind.code);
          const isEditing = editingCode === ind.code;
          return (
            <div key={ind.code} className="rounded-lg border border-line bg-white p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={already}
                  checked={Boolean(checked[ind.code])}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [ind.code]: e.target.checked }))}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-blue">{ind.code}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink2">{ind.sector}</span>
                    <span className="text-[10px] text-ink2">{LIST_LABELS[ind.list] ?? ind.list}</span>
                    <span className="text-[10px] text-ink2">{ind.tier}</span>
                    {ind.accumulation === "cum" && (
                      <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink2">
                        Cumulative
                      </span>
                    )}
                    {ind.edited && (
                      <span className="rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                        Edited
                      </span>
                    )}
                    {already && (
                      <span className="text-[10px] font-semibold text-ink2">Already on this scorecard</span>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="mt-1 text-sm text-ink">{ind.indicatorText}</div>
                  ) : (
                    editState && (
                      <div className="mt-2 flex flex-col gap-2">
                        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink2">
                          Indicator wording
                          <textarea
                            value={editState.indicatorText}
                            rows={2}
                            onChange={(e) => setEditState({ ...editState, indicatorText: e.target.value })}
                            className={FIELD_CLASS}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink2">
                          Method of calculation
                          <textarea
                            value={editState.method}
                            rows={2}
                            onChange={(e) => setEditState({ ...editState, method: e.target.value })}
                            className={FIELD_CLASS}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink2">
                          Means of verification (POE)
                          <textarea
                            value={editState.poe}
                            rows={2}
                            onChange={(e) => setEditState({ ...editState, poe: e.target.value })}
                            className={FIELD_CLASS}
                          />
                        </label>
                        <div className="flex gap-2">
                          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-ink2">
                            Sector / KPA
                            <input
                              type="text"
                              value={editState.sector}
                              onChange={(e) => setEditState({ ...editState, sector: e.target.value })}
                              className={FIELD_CLASS}
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-ink2">
                            Type
                            <select
                              value={editState.indicatorType}
                              onChange={(e) => setEditState({ ...editState, indicatorType: e.target.value })}
                              className={FIELD_CLASS}
                            >
                              <option value="Output">Output</option>
                              <option value="Outcome">Outcome</option>
                            </select>
                          </label>
                          <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-ink2">
                            Accumulation
                            <select
                              value={editState.accumulation}
                              onChange={(e) => setEditState({ ...editState, accumulation: e.target.value })}
                              className={FIELD_CLASS}
                            >
                              <option value="none">Standalone per quarter</option>
                              <option value="cum">Cumulative</option>
                            </select>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={pending}
                            className="rounded-md bg-ink px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                          >
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCode(null);
                              setEditState(null);
                            }}
                            className="rounded-md border border-line bg-white px-3 py-1 text-xs font-bold text-ink2 hover:border-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
                {!isEditing && (
                  <div className="flex flex-none flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(ind)}
                      className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink2 hover:border-ink"
                    >
                      Edit
                    </button>
                    {ind.edited && (
                      <button
                        type="button"
                        onClick={() => handleRestore(ind.code)}
                        disabled={pending}
                        className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink2 hover:border-ink disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={pending || checkedCount === 0}
        className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Working…" : `Add ${checkedCount} selected`}
      </button>
    </section>
  );
}
