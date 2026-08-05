"use client";

import { useMemo, useState } from "react";
import { saveKpiLibraryEntry } from "./actions";
import { CALC_TYPES, type CalcType } from "@/lib/data/kpi-calc-shared";
import type { KpiLibraryItem, DepartmentOrg } from "@/lib/data/kpi-library";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

/**
 * The policy writer's screen for authoring a KPI's answer type - picks one of
 * the 5 calc types and fills in its type-specific fields, instead of
 * hand-writing calc_config JSON. The live preview on the right renders
 * exactly the input a department capturer will see on the scorecard/EPAS
 * form, so the policy writer can sanity-check it before saving.
 */
export function KpiTypeForm({
  initial,
  departments,
  kpas,
  defaultOrgId,
}: {
  initial: KpiLibraryItem | null;
  departments: DepartmentOrg[];
  kpas: string[];
  defaultOrgId?: string;
}) {
  const [orgId, setOrgId] = useState(initial?.orgId ?? defaultOrgId ?? departments[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kpa, setKpa] = useState(initial?.kpa ?? "");
  // "select" picks from KPAs already in use (avoids typo'd near-duplicates);
  // "new" reveals a free-text field for a genuinely new KPA. Default to
  // "new" only when there's nothing to pick from yet, or the existing entry's
  // KPA isn't in the known list (legacy free-text value).
  const [kpaMode, setKpaMode] = useState<"select" | "new">(
    kpas.length === 0 || (initial?.kpa && !kpas.includes(initial.kpa)) ? "new" : "select"
  );
  const [idpRef, setIdpRef] = useState(initial?.idpRef ?? "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(initial?.unitOfMeasure ?? "");
  const [targetType, setTargetType] = useState(initial?.targetType ?? "stand-alone");

  const [calcType, setCalcType] = useState<CalcType>((initial?.calc?.type as CalcType) ?? "yesno");
  const [labels, setLabels] = useState((initial?.calc?.labels ?? []).join(", "));
  const [unit, setUnit] = useState(initial?.calc?.unit ?? "");
  const [den, setDen] = useState(initial?.calc?.den != null ? String(initial.calc.den) : "");
  const [x100, setX100] = useState(initial?.calc?.x100 ?? true);
  const [formula, setFormula] = useState(initial?.calc?.formula ?? "(a-b)/c");
  const [scale, setScale] = useState(initial?.calc?.scale != null ? String(initial.calc.scale) : "5");

  const labelList = useMemo(
    () => labels.split(",").map((l) => l.trim()).filter(Boolean),
    [labels]
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form action={saveKpiLibraryEntry} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={initial?.id ?? ""} />

        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">
            KPI details
          </div>
          <div className="flex flex-col gap-3">
            <label className={LABEL_CLASS}>
              Department
              <select
                name="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className={FIELD_CLASS}
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.municipalityName ? ` — ${d.municipalityName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL_CLASS}>
              KPI name
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={FIELD_CLASS}
                required
              />
            </label>
            <label className={LABEL_CLASS}>
              Description
              <textarea
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={FIELD_CLASS}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                KPA
                {kpaMode === "select" ? (
                  <select
                    name="kpa"
                    value={kpa}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setKpaMode("new");
                        setKpa("");
                      } else {
                        setKpa(e.target.value);
                      }
                    }}
                    className={FIELD_CLASS}
                  >
                    <option value="">— Select —</option>
                    {kpas.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    <option value="__new__">+ Add new KPA…</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      name="kpa"
                      value={kpa}
                      onChange={(e) => setKpa(e.target.value)}
                      placeholder="New KPA name"
                      className={FIELD_CLASS}
                      autoFocus
                    />
                    {kpas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setKpaMode("select");
                          setKpa("");
                        }}
                        className="flex-none text-xs font-semibold text-ink2 hover:text-ink hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </label>
              <label className={LABEL_CLASS}>
                IDP reference
                <input
                  name="idpRef"
                  value={idpRef}
                  onChange={(e) => setIdpRef(e.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                Unit of measure
                <input
                  name="unitOfMeasure"
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Target type
                <select
                  name="targetType"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="stand-alone">Stand-alone (per quarter)</option>
                  <option value="cumulative">Cumulative</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">
            Answer type
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CALC_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    calcType === t.value ? "border-gold bg-gold/10 font-semibold text-ink" : "border-line text-ink2"
                  }`}
                >
                  <input
                    type="radio"
                    name="calcType"
                    value={t.value}
                    checked={calcType === t.value}
                    onChange={() => setCalcType(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>

            {(calcType === "single" || calcType === "ratio" || calcType === "three" || calcType === "rating") && (
              <label className={LABEL_CLASS}>
                Field label{["ratio", "three"].includes(calcType) ? "s (comma-separated)" : ""}
                <input
                  name="labels"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder={
                    calcType === "ratio"
                      ? "e.g. Number achieved, Total planned"
                      : calcType === "three"
                        ? "e.g. Opening, Closing, Target"
                        : "e.g. Result value"
                  }
                  className={FIELD_CLASS}
                />
              </label>
            )}

            {calcType === "single" && (
              <label className={LABEL_CLASS}>
                Unit (optional, appended to the value)
                <input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={FIELD_CLASS} />
              </label>
            )}

            {calcType === "ratio" && (
              <div className="grid grid-cols-2 gap-3">
                <label className={LABEL_CLASS}>
                  Fixed denominator (optional)
                  <input
                    name="den"
                    value={den}
                    onChange={(e) => setDen(e.target.value)}
                    inputMode="decimal"
                    placeholder="leave blank to capture it"
                    className={FIELD_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Unit (used when not a %)
                  <input
                    name="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={x100}
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-ink2">
                  <input
                    type="checkbox"
                    name="x100"
                    checked={x100}
                    onChange={(e) => setX100(e.target.checked)}
                  />
                  Express as a percentage (×100)
                </label>
              </div>
            )}

            {calcType === "three" && (
              <label className={LABEL_CLASS}>
                Formula
                <select
                  name="formula"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="(a-b)/c">(A − B) ÷ C</option>
                </select>
                <span className="font-normal normal-case text-ink2">
                  Only formula shape supported today - ask the dev team to add more.
                </span>
              </label>
            )}

            {calcType === "rating" && (
              <label className={LABEL_CLASS}>
                Scale (1 to N)
                <input
                  name="scale"
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  inputMode="numeric"
                  className={FIELD_CLASS}
                />
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="self-start rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90"
        >
          {initial ? "Save changes" : "Create KPI type"}
        </button>
      </form>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink2">
            Live preview
          </div>
          <p className="mb-3 text-xs text-ink2">
            This is what the department will see when capturing a result each quarter.
          </p>
          <div className="rounded-lg border border-dashed border-line bg-paper p-4">
            <div className="mb-2 text-sm font-semibold text-ink">{name || "KPI name"}</div>
            <CalcPreview
              calcType={calcType}
              labels={labelList}
              unit={unit}
              den={den}
              x100={x100}
              scale={Number(scale) || 5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcPreview({
  calcType,
  labels,
  unit,
  den,
  x100,
  scale,
}: {
  calcType: CalcType;
  labels: string[];
  unit: string;
  den: string;
  x100: boolean;
  scale: number;
}) {
  const previewFieldClass =
    "pointer-events-none rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink2";
  const previewLabelClass = "flex flex-col gap-1 text-xs font-semibold text-ink2";

  if (calcType === "yesno") {
    return (
      <div className={previewLabelClass}>
        Achieved this quarter?
        <div className="mt-1 flex items-center gap-4 text-sm font-normal text-ink2">
          <label className="flex items-center gap-1.5">
            <input type="radio" disabled /> Yes (1)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" disabled /> No (0)
          </label>
        </div>
      </div>
    );
  }

  if (calcType === "rating") {
    return (
      <div className={previewLabelClass}>
        {labels[0] ?? "Rating"}
        <div className="mt-1 flex items-center gap-2 text-sm font-normal text-ink2">
          {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input type="radio" disabled /> {n}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (calcType === "single") {
    return (
      <label className={previewLabelClass}>
        {labels[0] ?? "Result value"} {unit && `(${unit})`}
        <input disabled className={previewFieldClass} placeholder="e.g. 42" />
      </label>
    );
  }

  if (calcType === "ratio") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={`${previewLabelClass} flex-1`}>
          {labels[0] ?? "Numerator"}
          <input disabled className={previewFieldClass} placeholder="e.g. 8" />
        </label>
        <label className={`${previewLabelClass} flex-1`}>
          {labels[1] ?? "Denominator"}
          {den ? (
            <div className={previewFieldClass}>{den} (fixed)</div>
          ) : (
            <input disabled className={previewFieldClass} placeholder="e.g. 10" />
          )}
        </label>
        <div className="pt-5 text-xs text-ink2">= result{x100 ? " %" : unit ? ` ${unit}` : ""}</div>
      </div>
    );
  }

  if (calcType === "three") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        {(["a", "b", "c"] as const).map((key, i) => (
          <label key={key} className={`${previewLabelClass} flex-1`}>
            {labels[i] ?? key.toUpperCase()}
            <input disabled className={previewFieldClass} placeholder="0" />
          </label>
        ))}
      </div>
    );
  }

  return (
    <label className={previewLabelClass}>
      Actual
      <input disabled className={previewFieldClass} placeholder="e.g. 80.78%" />
    </label>
  );
}
