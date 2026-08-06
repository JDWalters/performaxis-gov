"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  saveKpiRating,
  saveKpiNa,
  saveKpiComment,
  saveCompetencyRating,
  saveCompetencyComment,
  saveAssessmentMetaField,
} from "./assessment-actions";
import { finalRating, DEFAULT_RATING_SCALE } from "@/lib/data/appraisal-scoring";
import { friendlyAppraisalActual, type AppraisalKpi } from "@/lib/data/appraisals-shared";
import type { CompetencyAssessment, AssessmentMeta } from "@/lib/data/appraisals";

type RatingView = "self" | "mgr" | "panel";

const VIEW_LABEL: Record<RatingView, string> = { self: "Self-assessment", mgr: "Employer / MM rating", panel: "Panel rating" };
const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

// Short achievement-level names for competency ratings (2-5) - the
// Regulations don't name a "1" tier for competencies, unlike KPIs.
const COMPETENCY_SCALE_TERMS: Record<number, string> = { 5: "Superior", 4: "Advanced", 3: "Competent", 2: "Basic" };

function fmt2(n: number): string {
  return n.toFixed(2);
}

/** A 1-5 (or 2-5) rating dropdown. Selecting a value is itself the deliberate action - no onBlur dirty-tracking needed. */
function RatingSelect({
  value,
  options,
  onSave,
  disabled,
}: {
  value: number | null;
  options: number[];
  onSave: (v: string) => void;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  return (
    <select
      value={local}
      disabled={disabled}
      onChange={(e) => {
        setLocal(e.target.value);
        onSave(e.target.value);
      }}
      className={`${CELL_CLASS} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-paper disabled:text-ink2`}
    >
      <option value="">—</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

/** Free-text cell that only saves onBlur if it actually changed. */
function EditableField({
  value,
  onSave,
  placeholder,
  multiline,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);
  const common = {
    value: local,
    placeholder,
    disabled,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setLocal(e.target.value);
      dirtyRef.current = true;
    },
    onBlur: () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      onSave(local);
    },
    className: `${CELL_CLASS} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-paper disabled:text-ink2`,
  };
  return multiline ? <textarea rows={2} {...common} /> : <input type="text" {...common} />;
}

const TH_CLASS = "px-2 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-white";

/**
 * The self / manager / panel rating capture screen - the reference's
 * pageAssess(). One "Rating" column is shown per table, bound to whichever
 * of self/mgr/panel the segmented toggle currently has selected (matching
 * the reference exactly - not three always-visible columns), so entering a
 * rating is unambiguous about which of the three columns is being written.
 * Part A rates each KPI against its live-captured actual/target and a
 * rebased weight %, Part B rates the 12 competencies, and the Assessment
 * record panel below captures the meeting metadata the printed report needs.
 */
export function AssessmentRatingsPanel({
  cycleId,
  quarter,
  quarterLabel,
  reviewType,
  reviewDueDate,
  kpis,
  competencies,
  meta,
  canManagerRate,
  canSelfAssess,
}: {
  cycleId: string;
  quarter: number;
  quarterLabel: string;
  reviewType: string;
  reviewDueDate: string;
  kpis: AppraisalKpi[];
  competencies: CompetencyAssessment[];
  meta: AssessmentMeta;
  canManagerRate: boolean;
  canSelfAssess: boolean;
}) {
  const [view, setView] = useState<RatingView>("self");
  const [, startTransition] = useTransition();
  const editable = view === "self" ? canSelfAssess : canManagerRate;

  const saveRating = (kpiId: string, v: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("kpiId", kpiId);
    fd.set("quarter", String(quarter));
    fd.set("view", view);
    fd.set("rating", v);
    startTransition(() => saveKpiRating(fd));
  };
  const saveNa = (kpiId: string, na: boolean) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("kpiId", kpiId);
    fd.set("quarter", String(quarter));
    fd.set("na", String(na));
    startTransition(() => saveKpiNa(fd));
  };
  const saveComment = (kpiId: string, comment: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("kpiId", kpiId);
    fd.set("quarter", String(quarter));
    fd.set("comment", comment);
    startTransition(() => saveKpiComment(fd));
  };
  const saveCompRating = (competencyId: string, v: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("competencyId", competencyId);
    fd.set("quarter", String(quarter));
    fd.set("view", view);
    fd.set("rating", v);
    startTransition(() => saveCompetencyRating(fd));
  };
  const saveCompComment = (competencyId: string, comment: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("competencyId", competencyId);
    fd.set("quarter", String(quarter));
    fd.set("comment", comment);
    startTransition(() => saveCompetencyComment(fd));
  };
  const saveMeta = (field: string, value: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("quarter", String(quarter));
    fd.set("field", field);
    fd.set("value", value);
    startTransition(() => saveAssessmentMetaField(fd));
  };

  // Applicable = counted in the rebased weight column (not N/A, has a target
  // this quarter) - the reference's kpiWeights() "excluded" figure.
  const kpaApplicable = kpis.filter((k) => k.effectiveWeightPct > 0);
  const kpaExcluded = kpis.length - kpaApplicable.length;
  const kpaBase = kpaApplicable.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0);

  const compCount = competencies.length;
  const compPct100 = compCount ? 100 / compCount : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-[9px] border border-line border-l-4 border-l-gold bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink2">
        <b className="text-ink">{reviewType}</b> for {quarterLabel}, to be completed by{" "}
        <b className="text-ink">{reviewDueDate}</b>. The employee submits a self-assessment before the formal
        assessment. Where the employee could not perform for reasons outside the control of the employer and
        employee, mark the indicator <b className="text-ink">N/A</b> with evidence and it is excluded from the
        calculation.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(["self", "mgr", "panel"] as RatingView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                view === v ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
          {!editable && (
            <span className="rounded-md bg-blue-bg px-2 py-1 text-xs font-medium text-blue">
              You don&apos;t have permission to capture the &quot;{VIEW_LABEL[view]}&quot; column - showing view-only.
            </span>
          )}
        </div>
        <span className="text-xs text-ink2">
          The final score uses the <b className="text-ink">panel rating</b> where captured, otherwise the employer
          rating.
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-sm font-extrabold text-ink">Part A — Key Performance Areas</h3>
          <span className="text-xs font-semibold text-ink2">rating scale 1 – 5</span>
        </div>

        {kpis.length === 0 ? (
          <p className="text-sm text-ink2">No performance indicators on this plan yet.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-gold bg-gold-bg px-3 py-2 text-xs text-ink2">
              <span>
                <b className="text-ink">
                  {kpaApplicable.length} of {kpis.length}
                </b>{" "}
                indicators apply in Q{quarter}
                {kpaExcluded > 0 && (
                  <>
                    {" "}
                    — <b className="text-ink">{kpaExcluded}</b> excluded (no Q{quarter} target, or marked N/A)
                  </>
                )}
              </span>
              <span>
                Their weightings are re-based to total <b className="text-ink">100%</b>
                {kpaBase > 0 && Math.abs(kpaBase - 100) > 0.01 && (
                  <> (agreed weightings for these indicators come to {fmt2(kpaBase)}%)</>
                )}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink">
                    <th className={`${TH_CLASS} text-center`}>#</th>
                    <th className={TH_CLASS}>KPA</th>
                    <th className={TH_CLASS}>Indicator</th>
                    <th className={`${TH_CLASS} text-center`}>Q{quarter} target</th>
                    <th className={`${TH_CLASS} text-center`}>Weight</th>
                    <th className={TH_CLASS}>Actual / evidence</th>
                    <th className={`${TH_CLASS} text-center`}>Rating (1–5)</th>
                    <th className={`${TH_CLASS} text-center`}>Weighted</th>
                    <th className={`${TH_CLASS} text-center`}>N/A</th>
                    <th className={TH_CLASS}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k, i) => {
                    const r = k.result;
                    const na = r?.na ?? false;
                    const final = finalRating(r?.selfRating ?? null, r?.mgrRating ?? null, r?.panelRating ?? null);
                    const applicable = k.effectiveWeightPct > 0;
                    const weighted = applicable && final != null ? (final * k.effectiveWeightPct) / 100 : null;
                    const rowEditable = applicable && editable;
                    return (
                      <tr key={k.id} className={`border-b border-line last:border-0 ${na ? "bg-missed-bg" : ""}`}>
                        <td className="p-2 text-center font-mono text-ink2">{i + 1}</td>
                        <td className="p-2 font-mono text-ink2">{k.kpa ?? "—"}</td>
                        <td className="min-w-[220px] p-2 text-ink">{k.name}</td>
                        <td className="p-2 text-center">
                          {r?.targetValue ?? k.annualTarget ? (
                            <b className="text-ink">{r?.targetValue ?? k.annualTarget}</b>
                          ) : (
                            <span className="italic text-ink2">no target</span>
                          )}
                        </td>
                        <td className="p-2 text-center text-ink2">{applicable ? `${fmt2(k.effectiveWeightPct)}%` : "—"}</td>
                        <td className="min-w-[160px] p-2 text-ink2">{friendlyAppraisalActual(k) ?? "—"}</td>
                        <td className="min-w-[90px] p-2">
                          {applicable ? (
                            <RatingSelect
                              key={`${k.id}:${view}:${r?.selfRating ?? ""}:${r?.mgrRating ?? ""}:${r?.panelRating ?? ""}`}
                              value={view === "self" ? r?.selfRating ?? null : view === "mgr" ? r?.mgrRating ?? null : r?.panelRating ?? null}
                              options={[1, 2, 3, 4, 5]}
                              disabled={!rowEditable}
                              onSave={(v) => saveRating(k.id, v)}
                            />
                          ) : (
                            <span className="block text-center text-sm text-ink2">{na ? "N/A" : "Not assessed this quarter"}</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-bold text-ink">{weighted != null ? fmt2(weighted) : "—"}</td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={na}
                            disabled={!canManagerRate}
                            onChange={(e) => saveNa(k.id, e.target.checked)}
                          />
                        </td>
                        <td className="min-w-[200px] p-2">
                          {rowEditable ? (
                            <EditableField
                              key={r?.comment ?? ""}
                              value={r?.comment ?? ""}
                              placeholder="Comment"
                              onSave={(v) => saveComment(k.id, v)}
                            />
                          ) : (
                            <span className="block text-sm text-ink2">{r?.comment ?? ""}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gold-bg">
                    <td className="p-2 font-bold text-ink" colSpan={4}>
                      Total
                    </td>
                    <td className="p-2 text-center font-bold text-ink">{kpaApplicable.length ? "100.00%" : "—"}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
              {DEFAULT_RATING_SCALE.map((s) => (
                <span key={s.r}>
                  <b className="text-ink">{s.r}</b> {s.term}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-sm font-extrabold text-ink">Part B — Competencies</h3>
          <span className="text-xs font-semibold text-ink2">equal weighting · rating scale 2 – 5</span>
        </div>

        {competencies.length === 0 ? (
          <p className="text-sm text-ink2">No competency framework configured for this municipality yet.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-gold bg-gold-bg px-3 py-2 text-xs text-ink2">
              <span>
                <b className="text-ink">{compCount}</b> competencies
              </span>
              <span>
                each re-based to <b className="text-ink">{fmt2(compPct100)}% of 100</b>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink">
                    <th className={`${TH_CLASS} text-center`}>#</th>
                    <th className={TH_CLASS}>Competency</th>
                    <th className={TH_CLASS}>Group</th>
                    <th className={TH_CLASS}>Driving competencies</th>
                    <th className={`${TH_CLASS} text-center`}>Weight</th>
                    <th className={`${TH_CLASS} text-center`}>Rating (2–5)</th>
                    <th className={TH_CLASS}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {competencies.map((c, i) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="p-2 text-center font-mono text-ink2">{i + 1}</td>
                      <td className="min-w-[180px] p-2 font-medium text-ink">{c.name}</td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            c.groupName === "Core" ? "bg-blue-bg text-blue" : "bg-gold-bg text-gold"
                          }`}
                        >
                          {c.groupName ?? "—"}
                        </span>
                      </td>
                      <td className="min-w-[220px] p-2 text-xs text-ink2">{c.drivingText || "—"}</td>
                      <td className="p-2 text-center text-ink2">{fmt2(compPct100)}%</td>
                      <td className="min-w-[90px] p-2">
                        <RatingSelect
                          key={`${c.id}:${view}:${c.selfRating ?? ""}:${c.mgrRating ?? ""}:${c.panelRating ?? ""}`}
                          value={view === "self" ? c.selfRating : view === "mgr" ? c.mgrRating : c.panelRating}
                          options={[2, 3, 4, 5]}
                          disabled={!editable}
                          onSave={(v) => saveCompRating(c.id, v)}
                        />
                      </td>
                      <td className="min-w-[200px] p-2">
                        {editable ? (
                          <EditableField
                            key={c.comment ?? ""}
                            value={c.comment ?? ""}
                            placeholder="Comment"
                            onSave={(v) => saveCompComment(c.id, v)}
                          />
                        ) : (
                          <span className="block text-sm text-ink2">{c.comment ?? ""}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gold-bg">
                    <td className="p-2 font-bold text-ink" colSpan={4}>
                      Total
                    </td>
                    <td className="p-2 text-center font-bold text-ink">{compCount ? "100.00%" : "—"}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
              {[5, 4, 3, 2].map((r) => (
                <span key={r}>
                  <b className="text-ink">{r}</b> {COMPETENCY_SCALE_TERMS[r]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ink">Assessment record — employer / panel</h3>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Date of assessment
              <input
                type="date"
                defaultValue={meta.assessmentDate ?? ""}
                disabled={!canManagerRate}
                onBlur={(e) => saveMeta("assessmentDate", e.target.value)}
                className={`${CELL_CLASS} disabled:cursor-not-allowed disabled:border-transparent disabled:bg-paper disabled:text-ink2`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Assessment type
              <EditableField
                key={meta.assessmentType ?? ""}
                value={meta.assessmentType ?? ""}
                placeholder="e.g. Quarterly review meeting"
                disabled={!canManagerRate}
                onSave={(v) => saveMeta("assessmentType", v)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Panel members present
              <EditableField
                key={meta.panelMembers ?? ""}
                value={meta.panelMembers ?? ""}
                multiline
                placeholder="Names and designations"
                disabled={!canManagerRate}
                onSave={(v) => saveMeta("panelMembers", v)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Employer / panel comments
              <EditableField
                key={meta.employerComments ?? ""}
                value={meta.employerComments ?? ""}
                multiline
                disabled={!canManagerRate}
                onSave={(v) => saveMeta("employerComments", v)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Chairperson signature (name)
              <EditableField
                key={meta.chairSignature ?? ""}
                value={meta.chairSignature ?? ""}
                disabled={!canManagerRate}
                onSave={(v) => saveMeta("chairSignature", v)}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ink">Assessment record — employee</h3>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Employee comments
              <EditableField
                key={meta.employeeComments ?? ""}
                value={meta.employeeComments ?? ""}
                multiline
                disabled={!canSelfAssess}
                onSave={(v) => saveMeta("employeeComments", v)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Employee signature (name)
              <EditableField
                key={meta.employeeSignature ?? ""}
                value={meta.employeeSignature ?? ""}
                disabled={!canSelfAssess}
                onSave={(v) => saveMeta("employeeSignature", v)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
