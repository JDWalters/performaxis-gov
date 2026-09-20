"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { addLibraryKpisToScorecard, deleteScorecardKpis } from "../kpi-admin-actions";
import { CALC_TYPES, suggestNextRefCodes } from "@/lib/data/scorecards-shared";
import { Circular88Section, type Circular88Indicator } from "./Circular88Section";
import { KpiSetupEditor, ACC_OPTIONS, type EditableKpi } from "./KpiSetupEditor";
import { LibraryKpiPreviewModal } from "./LibraryKpiPreviewModal";

type CurrentKpi = EditableKpi & { c88Code: string | null; deptName: string | null };
type LibraryKpi = {
  id: string;
  name: string;
  kpa: string | null;
  unitOfMeasure: string | null;
  targetType: string;
  deptOrgId: string;
  deptName: string;
  alreadyOnScorecard: boolean;
  // Non-null for a National Treasury Circular 88 catalogue indicator, null
  // for a KPI the department authored itself - drives the "Circular 88
  // indicators" vs "My own KPIs" sub-tabs below.
  c88Code: string | null;
  method: string | null;
  kpiType: string | null;
  wards: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
};

const TH_CLASS = "whitespace-nowrap px-3 py-2";
const TD_CLASS = "whitespace-nowrap px-3 py-2 align-top";

const CALC_LABELS: Record<string, string> = Object.fromEntries(CALC_TYPES.map((t) => [t.value, t.label]));
const ACC_LABELS: Record<string, string> = Object.fromEntries(ACC_OPTIONS.map((o) => [o.id, o.label]));

/**
 * Current KPIs register: a single wide, scrollable table showing every
 * scorecard-setup column at once (matching the reference tool's
 * spreadsheet-style register), plus search/dept/KPA filters above it and an
 * always-available "Export CSV" link. Editing a field expands a full-width
 * inline row directly below the KPI (KpiSetupEditor, reused for every field -
 * register fields, capture setup, and the narrative fields) rather than a
 * modal or separate page - one click opens it, every field is editable in
 * place, and closing it collapses back to the wide read-only row. This
 * avoids duplicating ~15 separate single-cell edit affordances while still
 * keeping every value visible without a click, which a fully click-to-view
 * accordion (the previous design) did not.
 */
export function ManageKpisClient({
  scorecardId,
  departmentOrgId,
  isTopLayer,
  currentKpis,
  availableLibrary,
  circular88Catalogue,
}: {
  scorecardId: string;
  departmentOrgId: string;
  isTopLayer: boolean;
  currentKpis: CurrentKpi[];
  availableLibrary: LibraryKpi[];
  circular88Catalogue: Circular88Indicator[];
}) {
  const [deleteChecked, setDeleteChecked] = useState<Record<string, boolean>>({});
  const [addChecked, setAddChecked] = useState<Record<string, boolean>>({});
  const [refCodes, setRefCodes] = useState<Record<string, string>>({});
  const [libSearch, setLibSearch] = useState("");
  const [libTab, setLibTab] = useState<"c88" | "own">("c88");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewKpi, setPreviewKpi] = useState<LibraryKpi | null>(null);

  const [regSearch, setRegSearch] = useState("");
  const [regDept, setRegDept] = useState("");
  const [regKpa, setRegKpa] = useState("");

  const deleteCount = Object.values(deleteChecked).filter(Boolean).length;
  const addCount = Object.values(addChecked).filter(Boolean).length;

  // Department options for the register's Dept filter + the per-row editable
  // Dept select on Top Layer - drawn from the current register itself (every
  // dept already tagged on this scorecard) unioned with the full
  // cross-department library (every dept a KPI could still be added from or
  // reassigned to), so the dropdown never runs short of a department someone
  // might reassign a KPI to.
  const departmentOptions = useMemo(() => {
    if (!isTopLayer) return [];
    const byId = new Map<string, string>();
    for (const k of availableLibrary) byId.set(k.deptOrgId, k.deptName);
    for (const k of currentKpis) if (k.deptOrgId && k.deptName) byId.set(k.deptOrgId, k.deptName);
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableLibrary, currentKpis, isTopLayer]);

  const kpaOptions = useMemo(
    () => [...new Set(currentKpis.map((k) => k.kpa).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)),
    [currentKpis]
  );

  const filteredKpis = useMemo(() => {
    const term = regSearch.trim().toLowerCase();
    return currentKpis.filter((k) => {
      if (term && !`${k.name} ${k.refCode ?? ""} ${k.idpRef ?? ""}`.toLowerCase().includes(term)) return false;
      if (regDept && k.deptOrgId !== regDept) return false;
      if (regKpa && k.kpa !== regKpa) return false;
      return true;
    });
  }, [currentKpis, regSearch, regDept, regKpa]);

  const c88Count = useMemo(() => availableLibrary.filter((k) => k.c88Code).length, [availableLibrary]);
  const ownCount = availableLibrary.length - c88Count;

  const filteredLibrary = useMemo(() => {
    const term = libSearch.trim().toLowerCase();
    return availableLibrary.filter((k) => {
      if (libTab === "c88" ? !k.c88Code : k.c88Code) return false;
      if (!term) return true;
      return [k.name, k.kpa, isTopLayer ? k.deptName : null].some((f) => f?.toLowerCase().includes(term));
    });
  }, [availableLibrary, libSearch, libTab, isTopLayer]);

  // Next available ref code for this scorecard, offered as a prefilled
  // starting point in the single-item preview modal - same
  // suggestNextRefCodes logic addLibraryKpisToScorecard falls back to when
  // no ref code is supplied, so the suggestion and the actual auto-assigned
  // code never disagree.
  const suggestedRefCode = useMemo(
    () => suggestNextRefCodes(currentKpis.map((k) => k.refCode), 1)[0] ?? null,
    [currentKpis]
  );

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
    const byId = new Map(availableLibrary.map((k) => [k.id, k]));
    const items = Object.entries(addChecked)
      .filter(([, v]) => v)
      .map(([libraryId]) => ({
        libraryId,
        refCode: refCodes[libraryId]?.trim() || undefined,
        // On Top Layer, each added KPI is tagged with the department its
        // source library entry belongs to - that tag is independent,
        // per-KPI data on this scorecard from that point on, not a live
        // link back to the library or that department's own scorecard.
        deptOrgId: isTopLayer ? byId.get(libraryId)?.deptOrgId : undefined,
      }));
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

  const colCount = 15 + (isTopLayer ? 1 : 0);

  return (
    <div className="flex flex-col gap-8">
      {message && (
        <p className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink">{message}</p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">Current KPIs on this scorecard ({currentKpis.length})</h2>
          <a
            href={`/scorecards/${scorecardId}/export/register`}
            className="w-fit rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
          >
            ⬇ Export CSV
          </a>
        </div>

        {currentKpis.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
              placeholder="Search KPI or ref…"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 sm:max-w-xs"
            />
            {isTopLayer && (
              <select
                value={regDept}
                onChange={(e) => setRegDept(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">All departments</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={regKpa}
              onChange={(e) => setRegKpa(e.target.value)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">All KPAs</option>
              {kpaOptions.map((kpa) => (
                <option key={kpa} value={kpa}>
                  {kpa}
                </option>
              ))}
            </select>
            {(regSearch || regDept || regKpa) && (
              <button
                type="button"
                onClick={() => {
                  setRegSearch("");
                  setRegDept("");
                  setRegKpa("");
                }}
                className="text-xs font-semibold text-ink2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {currentKpis.length === 0 ? (
          <p className="text-sm text-ink2">No KPIs on this scorecard yet - add some from the library below.</p>
        ) : filteredKpis.length === 0 ? (
          <p className="text-sm text-ink2">No KPIs match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-[11px] font-bold uppercase text-ink2">
                  <th className={TH_CLASS}>Remove</th>
                  <th className={TH_CLASS}>Ref</th>
                  {isTopLayer && <th className={TH_CLASS}>Dept</th>}
                  <th className={TH_CLASS}>IDP Ref</th>
                  <th className={TH_CLASS}>KPA</th>
                  <th className={TH_CLASS}>Key Performance Indicator</th>
                  <th className={TH_CLASS}>Method of calculation</th>
                  <th className={TH_CLASS}>Type</th>
                  <th className={TH_CLASS}>Wards</th>
                  <th className={TH_CLASS}>Baseline</th>
                  <th className={TH_CLASS}>Annual target</th>
                  <th className={TH_CLASS}>POE</th>
                  <th className={TH_CLASS}>Lower is better</th>
                  <th className={TH_CLASS}>Calc type</th>
                  <th className={TH_CLASS}>Accumulation</th>
                  <th className={TH_CLASS}>Weight</th>
                  <th className={TH_CLASS}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredKpis.map((k) => (
                  <Fragment key={k.id}>
                    <tr className="border-b border-line last:border-0">
                      <td className={TD_CLASS}>
                        <input
                          type="checkbox"
                          checked={Boolean(deleteChecked[k.id])}
                          onChange={(e) => setDeleteChecked((prev) => ({ ...prev, [k.id]: e.target.checked }))}
                        />
                      </td>
                      <td className={`${TD_CLASS} font-mono text-xs text-ink2`}>{k.refCode ?? "—"}</td>
                      {isTopLayer && (
                        <td className={`${TD_CLASS} text-ink2`}>
                          {k.deptName ? (
                            <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                              {k.deptName}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className={`${TD_CLASS} text-ink2`}>{k.idpRef ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.kpa ?? "—"}</td>
                      <td className={`${TD_CLASS} whitespace-normal text-ink`} style={{ minWidth: "16rem" }}>
                        {k.c88Code && (
                          <div className="text-[10px] font-bold uppercase tracking-wide text-blue">C88: {k.c88Code}</div>
                        )}
                        {k.name}
                      </td>
                      <td className={`${TD_CLASS} whitespace-normal text-ink2`} style={{ minWidth: "12rem" }}>
                        {k.method ?? "—"}
                      </td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.kpiType ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.wards ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.baseline ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.annualTarget ?? "—"}</td>
                      <td className={`${TD_CLASS} whitespace-normal text-ink2`} style={{ minWidth: "10rem" }}>
                        {k.poe ?? "—"}
                      </td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.lower ? "Yes" : "No"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{CALC_LABELS[k.calc?.type ?? ""] ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{ACC_LABELS[k.acc ?? "none"] ?? "—"}</td>
                      <td className={`${TD_CLASS} text-ink2`}>{k.weight ?? 0}%</td>
                      <td className={TD_CLASS}>
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === k.id ? null : k.id))}
                          className="text-[11px] font-bold text-blue hover:underline"
                        >
                          {expandedId === k.id ? "Hide" : "Edit"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === k.id && (
                      <tr className="border-b border-line last:border-0">
                        <td colSpan={colCount} className="bg-paper px-3 py-3">
                          <KpiSetupEditor
                            scorecardId={scorecardId}
                            kpi={k}
                            onClose={() => setExpandedId(null)}
                            isTopLayer={isTopLayer}
                            departmentOptions={departmentOptions}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
        <h2 className="text-sm font-bold text-ink">
          {isTopLayer
            ? `Add KPIs from library, any department (${availableLibrary.length})`
            : `Add from this department's library (${availableLibrary.length})`}
        </h2>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLibTab("c88")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              libTab === "c88" ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            Circular 88 indicators ({c88Count})
          </button>
          <button
            type="button"
            onClick={() => setLibTab("own")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              libTab === "own" ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            My own KPIs ({ownCount})
          </button>
        </div>

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
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">KPI</th>
                  {isTopLayer && <th className="px-3 py-2">Dept</th>}
                  <th className="px-3 py-2">KPA</th>
                  <th className="px-3 py-2">Ref code</th>
                  <th className="px-3 py-2" />
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
                      <div className="text-ink">
                        {k.c88Code && (
                          <span className="mr-1.5 rounded bg-blue-bg px-1.5 py-0.5 text-[10px] font-bold text-blue">
                            {k.c88Code}
                          </span>
                        )}
                        {k.name}
                      </div>
                      {k.alreadyOnScorecard && (
                        <div className="text-[11px] font-semibold text-ink2">Already on this scorecard</div>
                      )}
                    </td>
                    {isTopLayer && (
                      <td className="px-3 py-2 align-top text-ink2">
                        <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                          {k.deptName}
                        </span>
                      </td>
                    )}
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
                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        disabled={k.alreadyOnScorecard}
                        onClick={() => setPreviewKpi(k)}
                        className="whitespace-nowrap rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink disabled:opacity-50"
                      >
                        Add…
                      </button>
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

      {previewKpi && (
        <LibraryKpiPreviewModal
          scorecardId={scorecardId}
          kpi={previewKpi}
          suggestedRefCode={suggestedRefCode}
          isTopLayer={isTopLayer}
          onClose={() => setPreviewKpi(null)}
          onAdded={(msg) => {
            setMessage(msg);
            setPreviewKpi(null);
          }}
        />
      )}

      <Circular88Section
        scorecardId={scorecardId}
        departmentOrgId={departmentOrgId}
        catalogue={circular88Catalogue}
        usedCodes={new Set(currentKpis.map((k) => k.c88Code).filter((c): c is string => Boolean(c)))}
      />
    </div>
  );
}
