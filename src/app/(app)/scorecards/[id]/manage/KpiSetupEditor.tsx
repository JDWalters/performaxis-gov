"use client";

import { useState, useTransition } from "react";
import { CALC_TYPES, type CalcType, type KpiCalc } from "@/lib/data/scorecards-shared";
import { updateScorecardKpiSetup } from "../kpi-admin-actions";

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1.5 text-xs text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-[11px] font-semibold text-ink2";

// The reference tool's "Results across quarters" dropdown - "none" is its
// own literal id (not just "no accumulation set"), matching how acc is
// stored on scorecard_kpis and read back by accOf() in sdbip-status.ts.
const ACC_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "Standard — each quarter separate" },
  { id: "cum", label: "Cumulative — results add up (YTD)" },
  { id: "carry", label: "Carry-over — achieved stays achieved" },
];

export type EditableKpi = {
  id: string;
  name: string;
  calc: KpiCalc | null;
  lower: boolean;
  acc: string | null;
  method: string | null;
  kpiType: string | null;
  wards: string | null;
  baseline: string | null;
  annualTarget: string | null;
  poe: string | null;
};

/**
 * Inline "Capture setup (admin)" + "Results across quarters" + scorecard
 * setup editor for one KPI, matching the reference tool's register-row
 * dropdowns. Mounted only while its row is expanded (the parent
 * ManageKpisClient owns which single KPI is expanded, so this component
 * stays a plain form rather than also managing its own open/closed state).
 */
export function KpiSetupEditor({
  scorecardId,
  kpi,
  onClose,
}: {
  scorecardId: string;
  kpi: EditableKpi;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [calcType, setCalcType] = useState<CalcType>((kpi.calc?.type as CalcType) ?? "yesno");
  const [labels, setLabels] = useState((kpi.calc?.labels ?? []).join(", "));
  const [unit, setUnit] = useState(kpi.calc?.unit ?? "");
  const [den, setDen] = useState(kpi.calc?.den != null ? String(kpi.calc.den) : "");
  const [x100, setX100] = useState(kpi.calc?.x100 ?? true);
  const [formula, setFormula] = useState(kpi.calc?.formula ?? "(a-b)/c");
  const [scale, setScale] = useState(kpi.calc?.scale != null ? String(kpi.calc.scale) : "5");
  const [lower, setLower] = useState(kpi.lower);
  const [acc, setAcc] = useState(kpi.acc ?? "none");

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line bg-paper p-3">
      {message && <p className="text-[11px] font-semibold text-ink">{message}</p>}

      <form
        action={(formData) => {
          setMessage(null);
          startTransition(async () => {
            try {
              await updateScorecardKpiSetup(scorecardId, kpi.id, formData);
              setMessage("Saved.");
            } catch {
              setMessage("Couldn't save - check your connection and try again.");
            }
          });
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className={LABEL_CLASS}>
            Capture setup (answer type)
            <select
              name="calcType"
              value={calcType}
              onChange={(e) => setCalcType(e.target.value as CalcType)}
              className={FIELD_CLASS}
            >
              {CALC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS}>
            Results across quarters
            <select name="acc" value={acc} onChange={(e) => setAcc(e.target.value)} className={FIELD_CLASS}>
              {ACC_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(calcType === "single" || calcType === "ratio" || calcType === "three" || calcType === "rating") && (
          <label className={LABEL_CLASS}>
            Field label{["ratio", "three"].includes(calcType) ? "s (comma-separated)" : ""}
            <input name="labels" value={labels} onChange={(e) => setLabels(e.target.value)} className={FIELD_CLASS} />
          </label>
        )}
        {calcType === "single" && (
          <label className={LABEL_CLASS}>
            Unit (optional)
            <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={FIELD_CLASS} />
          </label>
        )}
        {calcType === "ratio" && (
          <div className="grid grid-cols-3 gap-2">
            <label className={LABEL_CLASS}>
              Fixed denominator
              <input name="den" value={den} onChange={(e) => setDen(e.target.value)} inputMode="decimal" className={FIELD_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Unit (if not %)
              <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={x100} className={FIELD_CLASS} />
            </label>
            <label className="flex items-center gap-1.5 self-end pb-1.5 text-[11px] font-semibold text-ink2">
              <input type="checkbox" name="x100" checked={x100} onChange={(e) => setX100(e.target.checked)} />
              As a % (×100)
            </label>
          </div>
        )}
        {calcType === "three" && (
          <label className={LABEL_CLASS}>
            Formula
            <select name="formula" value={formula} onChange={(e) => setFormula(e.target.value)} className={FIELD_CLASS}>
              <option value="(a-b)/c">(A − B) ÷ C</option>
            </select>
          </label>
        )}
        {calcType === "rating" && (
          <label className={LABEL_CLASS}>
            Scale (1 to N)
            <input name="scale" value={scale} onChange={(e) => setScale(e.target.value)} inputMode="numeric" className={FIELD_CLASS} />
          </label>
        )}

        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2">
          <input type="checkbox" name="lower" checked={lower} onChange={(e) => setLower(e.target.checked)} />
          Lower result is better (e.g. response times, complaints)
        </label>

        <div className="border-t border-line pt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink2">Scorecard setup</div>
          <div className="flex flex-col gap-2">
            <label className={LABEL_CLASS}>
              Method of calculation
              <textarea name="method" defaultValue={kpi.method ?? ""} rows={2} className={FIELD_CLASS} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={LABEL_CLASS}>
                Type
                <input name="kpiType" defaultValue={kpi.kpiType ?? ""} className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Wards
                <input name="wards" defaultValue={kpi.wards ?? ""} className={FIELD_CLASS} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={LABEL_CLASS}>
                Baseline
                <input name="baseline" defaultValue={kpi.baseline ?? ""} className={FIELD_CLASS} />
              </label>
              <label className={LABEL_CLASS}>
                Annual target
                <input name="annualTarget" defaultValue={kpi.annualTarget ?? ""} className={FIELD_CLASS} />
              </label>
            </div>
            <label className={LABEL_CLASS}>
              POE and notes
              <textarea name="poe" defaultValue={kpi.poe ?? ""} rows={2} className={FIELD_CLASS} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save setup"}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-ink2 hover:underline">
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
