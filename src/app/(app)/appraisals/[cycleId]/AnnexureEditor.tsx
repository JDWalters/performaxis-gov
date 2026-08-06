"use client";

import { useRef, useState, useTransition } from "react";
import {
  addAnnexureKpi,
  updateAnnexureKpiField,
  updateAnnexureKpiTarget,
  updateAnnexureKpiWeight,
  deleteAnnexureKpi,
  evenSplitAnnexureWeights,
  scaleAnnexureWeightsTo100,
} from "./annexure-actions";
import type { AnnexureKpi } from "@/lib/data/annexure";

const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const NATIONAL_KPAS = [
  { code: "BSD", name: "Basic Service Delivery" },
  { code: "MTOD", name: "Municipal Transformation and Organisational Development" },
  { code: "LED", name: "Local Economic Development" },
  { code: "MFVM", name: "Municipal Financial Viability and Management" },
  { code: "GGPP", name: "Good Governance and Public Participation" },
];

/**
 * A text/number cell that only saves onBlur if its value actually changed
 * since the last save - focusing a cell and clicking away without editing
 * it must never fire a save (this exact bug was fixed on the capture cards
 * earlier and applies identically here).
 */
function EditableCell({
  value,
  onSave,
  placeholder,
  className,
  list,
}: {
  // Read once on mount only - the parent keys this component on `value`
  // (see the `key={...}` on each <EditableCell> below) so it remounts and
  // resyncs whenever the server's value changes for a reason other than
  // this exact cell being edited (e.g. another row's weight edit
  // rebalancing this one), without disrupting an in-progress edit.
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);
  return (
    <input
      className={className ?? CELL_CLASS}
      value={local}
      placeholder={placeholder}
      list={list}
      onChange={(e) => {
        setLocal(e.target.value);
        dirtyRef.current = true;
      }}
      onBlur={() => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        onSave(local);
      }}
    />
  );
}

function KpiRow({ cycleId, kpi }: { cycleId: string; kpi: AnnexureKpi }) {
  const [, startTransition] = useTransition();

  const saveField = (field: string, value: string) => {
    const fd = new FormData();
    fd.set("id", kpi.id);
    fd.set("cycleId", cycleId);
    fd.set("field", field);
    fd.set("value", value);
    startTransition(() => updateAnnexureKpiField(fd));
  };
  const saveTarget = (quarter: number, value: string) => {
    const fd = new FormData();
    fd.set("kpiId", kpi.id);
    fd.set("cycleId", cycleId);
    fd.set("quarter", String(quarter));
    fd.set("value", value);
    startTransition(() => updateAnnexureKpiTarget(fd));
  };
  const saveWeight = (value: string) => {
    const fd = new FormData();
    fd.set("kpiId", kpi.id);
    fd.set("cycleId", cycleId);
    fd.set("weight", value);
    startTransition(() => updateAnnexureKpiWeight(fd));
  };

  return (
    <tr className="border-b border-line last:border-0">
      <td className="p-1">
        <button
          type="button"
          title="Remove this indicator"
          onClick={() => {
            if (!confirm(`Remove "${kpi.name}"?`)) return;
            const fd = new FormData();
            fd.set("kpiId", kpi.id);
            fd.set("cycleId", cycleId);
            startTransition(() => deleteAnnexureKpi(fd));
          }}
          className="rounded px-1.5 py-0.5 text-xs font-bold text-missed hover:bg-missed-bg"
        >
          ✕
        </button>
      </td>
      <td className="min-w-[110px] p-1">
        <EditableCell key={kpi.kpa} value={kpi.kpa ?? ""} onSave={(v) => saveField("kpa", v)} placeholder="KPA" list="epas-kpa-list" />
      </td>
      <td className="min-w-[220px] p-1">
        <EditableCell key={kpi.name} value={kpi.name} onSave={(v) => saveField("name", v)} placeholder="Key performance indicator" />
      </td>
      <td className="min-w-[140px] p-1">
        <EditableCell
          key={kpi.unitOfMeasure}
          value={kpi.unitOfMeasure ?? ""}
          onSave={(v) => saveField("unit_of_measure", v)}
          placeholder="Unit of measure"
        />
      </td>
      <td className="min-w-[100px] p-1">
        <EditableCell key={kpi.baseline} value={kpi.baseline ?? ""} onSave={(v) => saveField("baseline", v)} placeholder="Baseline" />
      </td>
      <td className="min-w-[100px] p-1">
        <EditableCell
          key={kpi.annualTarget}
          value={kpi.annualTarget ?? ""}
          onSave={(v) => saveField("annual_target", v)}
          placeholder="Annual target"
        />
      </td>
      {[0, 1, 2, 3].map((qi) => (
        <td key={qi} className="min-w-[80px] p-1">
          <EditableCell
            key={kpi.quarterlyTargets[qi]}
            value={kpi.quarterlyTargets[qi] ?? ""}
            onSave={(v) => saveTarget(qi + 1, v)}
            placeholder={`Q${qi + 1}`}
          />
        </td>
      ))}
      <td className="min-w-[90px] p-1">
        <EditableCell
          key={`${kpi.weight}:${kpi.weightLocked}`}
          value={String(kpi.weight)}
          onSave={saveWeight}
          placeholder="auto"
          className={`${CELL_CLASS} ${kpi.weightLocked ? "border-gold" : "border-line"}`}
        />
        <div className="mt-0.5 text-center text-[10px] text-ink2">{kpi.weightLocked ? "set by you" : "automatic"}</div>
      </td>
      <td className="min-w-[160px] p-1">
        <EditableCell key={kpi.poe} value={kpi.poe ?? ""} onSave={(v) => saveField("poe", v)} placeholder="Evidence (POE)" />
      </td>
    </tr>
  );
}

export function AnnexureEditor({ cycleId, kpis, totalWeight }: { cycleId: string; kpis: AnnexureKpi[]; totalWeight: number }) {
  const [, startTransition] = useTransition();
  const weightOk = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="flex flex-col gap-3">
      <datalist id="epas-kpa-list">
        {NATIONAL_KPAS.map((k) => (
          <option key={k.code} value={k.code}>
            {k.name}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const fd = new FormData();
            fd.set("cycleId", cycleId);
            startTransition(() => addAnnexureKpi(fd));
          }}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90"
        >
          + Add performance indicator
        </button>
        {kpis.length > 0 && (
          <button
            type="button"
            title="Clear every weighting you have set and split 100% evenly again"
            onClick={() => {
              const fd = new FormData();
              fd.set("cycleId", cycleId);
              startTransition(() => evenSplitAnnexureWeights(fd));
            }}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
          >
            ↺ Even split
          </button>
        )}
        {!weightOk && totalWeight > 0 && (
          <button
            type="button"
            title="Keep the agreed weightings in proportion but scale them so the column totals 100%"
            onClick={() => {
              const fd = new FormData();
              fd.set("cycleId", cycleId);
              startTransition(() => scaleAnnexureWeightsTo100(fd));
            }}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
          >
            ⚖ Scale to 100%
          </button>
        )}
        <span className={`stag ${weightOk ? "stag-met" : "stag-missed"}`}>
          Total weighting: {totalWeight.toFixed(1)}% {weightOk ? "✓" : ""}
        </span>
      </div>

      <p className="text-xs text-ink2">
        Weightings are worked out automatically and always come to 100%. Type over any figure to fix that
        indicator&apos;s weighting - the rest share what is left, equally. Clear the box to hand it back to the
        automatic split.
      </p>

      {kpis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink2">
          No performance indicators yet. Add the key performance indicators from the SDBIP that this employee is
          accountable for.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                <th className="p-1" />
                <th className="p-1">KPA</th>
                <th className="p-1">Key Performance Indicator / Output</th>
                <th className="p-1">Unit of measure</th>
                <th className="p-1">Baseline</th>
                <th className="p-1">Annual target</th>
                <th className="p-1">Q1</th>
                <th className="p-1">Q2</th>
                <th className="p-1">Q3</th>
                <th className="p-1">Q4</th>
                <th className="p-1">Weight %</th>
                <th className="p-1">Evidence (POE)</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <KpiRow key={k.id} cycleId={cycleId} kpi={k} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
