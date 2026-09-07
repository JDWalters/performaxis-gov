"use client";

import { useState } from "react";
import { saveAppraisalKpiLibraryEntry } from "./actions";
import type { AppraisalKpiLibraryItem, LibraryEmployee } from "@/lib/data/appraisal-kpi-library";
import { NATIONAL_KPAS } from "@/lib/data/kpa-shared";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

/**
 * Create/edit form for one EPAS KPI library entry - direct sibling of
 * KpiTypeForm.tsx (the SDBIP-side equivalent), but far simpler: no answer-type
 * (calc_config) authoring, since a library indicator only ever seeds a plan
 * KPI's descriptive fields (kpa/name/unit/baseline/target/poe), matching the
 * reference tool's mpa/index.html library modal field-for-field.
 */
export function EpasKpiForm({
  initial,
  orgId,
  employees,
}: {
  initial: AppraisalKpiLibraryItem | null;
  orgId: string;
  employees: LibraryEmployee[];
}) {
  const [refCode, setRefCode] = useState(initial?.refCode ?? "");
  const [kpa, setKpa] = useState(initial?.kpa ?? "");
  const [c88Code, setC88Code] = useState(initial?.c88Code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(initial?.unitOfMeasure ?? "");
  const [idpRef, setIdpRef] = useState(initial?.idpRef ?? "");
  const [baseline, setBaseline] = useState(initial?.baseline ?? "");
  const [annualTarget, setAnnualTarget] = useState(initial?.annualTarget ?? "");
  const [poe, setPoe] = useState(initial?.poe ?? "");
  const [allocatedEmployeeId, setAllocatedEmployeeId] = useState(initial?.allocatedEmployeeId ?? "");

  return (
    <form action={saveAppraisalKpiLibraryEntry} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="orgId" value={orgId} />

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Indicator details</div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL_CLASS}>
              Reference
              <input
                name="refCode"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                placeholder="e.g. OMM7"
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              KPA — required
              <select name="kpa" value={kpa} onChange={(e) => setKpa(e.target.value)} className={FIELD_CLASS} required>
                <option value="">— Select a KPA —</option>
                {NATIONAL_KPAS.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.code} — {k.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={LABEL_CLASS}>
            Key Performance Indicator / Output
            <textarea name="name" value={name} onChange={(e) => setName(e.target.value)} rows={2} className={FIELD_CLASS} required />
          </label>
          <label className={LABEL_CLASS}>
            Unit of measure
            <textarea
              name="unitOfMeasure"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              rows={2}
              className={FIELD_CLASS}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL_CLASS}>
              Baseline
              <input name="baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} className={FIELD_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Annual target
              <input
                name="annualTarget"
                value={annualTarget}
                onChange={(e) => setAnnualTarget(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL_CLASS}>
              IDP reference
              <input name="idpRef" value={idpRef} onChange={(e) => setIdpRef(e.target.value)} className={FIELD_CLASS} />
            </label>
            <label className={LABEL_CLASS}>
              Circular 88 code
              <input name="c88Code" value={c88Code} onChange={(e) => setC88Code(e.target.value)} placeholder="optional" className={FIELD_CLASS} />
            </label>
          </div>
          <label className={LABEL_CLASS}>
            Evidence (POE)
            <textarea name="poe" value={poe} onChange={(e) => setPoe(e.target.value)} rows={2} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Allocated to
            <select
              name="allocatedEmployeeId"
              value={allocatedEmployeeId}
              onChange={(e) => setAllocatedEmployeeId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">— Not allocated</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90">
          {initial ? "Save changes" : "Add to library"}
        </button>
      </div>
    </form>
  );
}
