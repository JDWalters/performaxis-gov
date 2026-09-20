"use client";

import { useState, useTransition } from "react";
import { addLibraryKpisToScorecard } from "../kpi-admin-actions";

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-[11px] font-semibold text-ink2";

export type PreviewLibraryKpi = {
  id: string;
  name: string;
  kpa: string | null;
  deptOrgId: string;
  deptName: string;
  c88Code: string | null;
  method: string | null;
  kpiType: string | null;
  wards: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
};

/**
 * Single-item "Add to scorecard" preview/edit modal - matches the reference
 * tool's own-save flow: clicking one library row's Add button (as opposed to
 * checking it for bulk add) opens this instead of adding immediately, shows
 * the KPI's scorecard-setup fields as an editable preview pre-filled with the
 * next available ref code, and only writes to scorecard_kpis once the user
 * confirms here. Cancelling closes without calling the add action at all.
 * Bulk multi-select add (ManageKpisClient's "Add N selected" button) skips
 * this entirely, same as the reference tool's own bulk button.
 */
export function LibraryKpiPreviewModal({
  scorecardId,
  kpi,
  suggestedRefCode,
  isTopLayer,
  onClose,
  onAdded,
}: {
  scorecardId: string;
  kpi: PreviewLibraryKpi;
  /** Next available ref code for this scorecard, from suggestNextRefCodes - prefilled but still editable. */
  suggestedRefCode: string | null;
  isTopLayer: boolean;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(kpi.name);
  const [refCode, setRefCode] = useState(suggestedRefCode ?? "");
  const [kpa, setKpa] = useState(kpi.kpa ?? "");
  const [method, setMethod] = useState(kpi.method ?? "");
  const [kpiType, setKpiType] = useState(kpi.kpiType ?? "");
  const [wards, setWards] = useState(kpi.wards ?? "");
  const [baseline, setBaseline] = useState(kpi.baseline ?? "");
  const [annualTarget, setAnnualTarget] = useState(kpi.annualTarget ?? "");
  const [poe, setPoe] = useState(kpi.poe ?? "");

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await addLibraryKpisToScorecard(scorecardId, [
          {
            libraryId: kpi.id,
            refCode: refCode.trim() || undefined,
            deptOrgId: isTopLayer ? kpi.deptOrgId : undefined,
            overrides: { name, kpa, method, kpiType, wards, baseline, annualTarget, poe },
          },
        ]);
        if (res.added > 0) {
          onAdded(`Added "${name}"${refCode.trim() ? ` as ${refCode.trim()}` : ""} to the scorecard.`);
        } else {
          setError(res.skipped.length ? `Couldn't add - ${res.skipped.join(", ")}.` : "Couldn't add that KPI.");
        }
      } catch {
        setError("Couldn't add - check your connection and try again.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${kpi.name} to scorecard`}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink2">
              {kpi.c88Code ? `Circular 88 · ${kpi.c88Code}` : "My own KPI"}
              {isTopLayer && ` · ${kpi.deptName}`}
            </div>
            <h2 className="mt-1 text-sm font-bold text-ink">Add to scorecard</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md border border-line px-2 py-1 text-xs font-bold text-ink2 hover:border-ink hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md border border-missed bg-missed-bg px-3 py-2 text-xs font-semibold text-missed">{error}</p>}
          <p className="text-xs text-ink2">
            Review and adjust these fields before adding - once confirmed they&apos;re copied onto this scorecard as
            their own independent copy, separate from the library entry.
          </p>

          <label className={LABEL_CLASS}>
            Key Performance Indicator
            <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={LABEL_CLASS}>
              Ref code
              <input
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                placeholder="auto"
                className={`${FIELD_CLASS} font-mono`}
              />
            </label>
            <label className={LABEL_CLASS}>
              KPA
              <input value={kpa} onChange={(e) => setKpa(e.target.value)} className={FIELD_CLASS} />
            </label>
          </div>

          <label className={LABEL_CLASS}>
            Method of calculation
            <textarea value={method} onChange={(e) => setMethod(e.target.value)} rows={2} className={FIELD_CLASS} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={LABEL_CLASS}>
              Type
              <input value={kpiType} onChange={(e) => setKpiType(e.target.value)} className={FIELD_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Wards
              <input value={wards} onChange={(e) => setWards(e.target.value)} className={FIELD_CLASS} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={LABEL_CLASS}>
              Baseline
              <input value={baseline} onChange={(e) => setBaseline(e.target.value)} className={FIELD_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Annual target
              <input value={annualTarget} onChange={(e) => setAnnualTarget(e.target.value)} className={FIELD_CLASS} />
            </label>
          </div>

          <label className={LABEL_CLASS}>
            POE and notes
            <textarea value={poe} onChange={(e) => setPoe(e.target.value)} rows={2} className={FIELD_CLASS} />
          </label>

          <p className="text-[11px] text-ink2">
            Answer type, results-across-quarters, and lower-is-better are copied from the library entry as-is - edit
            those afterwards from the KPI&apos;s own &quot;Edit&quot; row on the register above.
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !name.trim()}
            className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add to scorecard"}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-ink2 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
