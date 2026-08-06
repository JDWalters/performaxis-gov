"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  saveKpiRating,
  saveKpiNa,
  saveCompetencyRating,
  saveCompetencyComment,
  saveAssessmentMetaField,
} from "./assessment-actions";
import { finalRating } from "@/lib/data/appraisal-scoring";
import type { AppraisalKpi } from "@/lib/data/appraisals-shared";
import type { CompetencyAssessment, AssessmentMeta } from "@/lib/data/appraisals";

type RatingView = "self" | "mgr" | "panel";

const VIEW_LABEL: Record<RatingView, string> = { self: "Self-assessment", mgr: "Employer / MM rating", panel: "Panel rating" };
const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

/** A 1-5 rating dropdown. Selecting a value is itself the deliberate action - no onBlur dirty-tracking needed (unlike free-text cells, a select's onChange never fires without the user actually choosing something). */
function RatingSelect({
  value,
  onSave,
  disabled,
}: {
  value: number | null;
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
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

/** Free-text cell that only saves onBlur if it actually changed - the same fix applied to every other capture surface in this app. */
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

function ReadOnlyRating({ value }: { value: number | null }) {
  return <span className="block text-center text-sm text-ink2">{value ?? "—"}</span>;
}

/**
 * The self / manager / panel rating capture screen - the reference's
 * pageAssess(). A toggle picks which of the three columns the signed-in
 * user is currently entering (each still individually gated by
 * canSelfAssess/canManagerRate); the other two columns are always visible
 * read-only so nobody has to flip views just to see what's already been
 * captured. Part A rates each KPI (with an N/A escape hatch and a live
 * rebased weight %), Part B rates the 12 competencies, and the Assessment
 * record panel captures the meeting metadata the printed report needs.
 */
export function AssessmentRatingsPanel({
  cycleId,
  quarter,
  kpis,
  competencies,
  meta,
  canManagerRate,
  canSelfAssess,
}: {
  cycleId: string;
  quarter: number;
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

  return (
    <div className="flex flex-col gap-4">
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

      <div>
        <h3 className="mb-2 text-sm font-extrabold text-ink">Part A — Key Performance Areas</h3>
        {kpis.length === 0 ? (
          <p className="text-sm text-ink2">No performance indicators on this plan yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                  <th className="p-2">KPI</th>
                  <th className="p-2">Weight</th>
                  <th className="p-2 text-center">Self</th>
                  <th className="p-2 text-center">Employer/MM</th>
                  <th className="p-2 text-center">Panel</th>
                  <th className="p-2 text-center">Final</th>
                  <th className="p-2 text-center">N/A</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((k) => {
                  const r = k.result;
                  const na = r?.na ?? false;
                  const final = finalRating(r?.selfRating ?? null, r?.mgrRating ?? null, r?.panelRating ?? null);
                  return (
                    <tr key={k.id} className="border-b border-line last:border-0">
                      <td className="min-w-[220px] p-2">
                        {k.kpa && <div className="text-[10px] font-bold uppercase tracking-wide text-ink2">{k.kpa}</div>}
                        <div className="font-medium text-ink">{k.name}</div>
                      </td>
                      <td className="p-2 text-ink2">{na ? "—" : `${k.effectiveWeightPct.toFixed(1)}%`}</td>
                      <td className="min-w-[80px] p-2">
                        {view === "self" ? (
                          <RatingSelect
                            key={`${k.id}:self:${r?.selfRating ?? ""}`}
                            value={r?.selfRating ?? null}
                            disabled={!editable || na}
                            onSave={(v) => saveRating(k.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={r?.selfRating ?? null} />
                        )}
                      </td>
                      <td className="min-w-[80px] p-2">
                        {view === "mgr" ? (
                          <RatingSelect
                            key={`${k.id}:mgr:${r?.mgrRating ?? ""}`}
                            value={r?.mgrRating ?? null}
                            disabled={!editable || na}
                            onSave={(v) => saveRating(k.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={r?.mgrRating ?? null} />
                        )}
                      </td>
                      <td className="min-w-[80px] p-2">
                        {view === "panel" ? (
                          <RatingSelect
                            key={`${k.id}:panel:${r?.panelRating ?? ""}`}
                            value={r?.panelRating ?? null}
                            disabled={!editable || na}
                            onSave={(v) => saveRating(k.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={r?.panelRating ?? null} />
                        )}
                      </td>
                      <td className="p-2 text-center font-bold text-ink">{final ?? "—"}</td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={na}
                          disabled={!canManagerRate}
                          onChange={(e) => saveNa(k.id, e.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-extrabold text-ink">Part B — Competencies</h3>
        {competencies.length === 0 ? (
          <p className="text-sm text-ink2">No competency framework configured for this municipality yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                  <th className="p-2">Competency</th>
                  <th className="p-2 text-center">Self</th>
                  <th className="p-2 text-center">Employer/MM</th>
                  <th className="p-2 text-center">Panel</th>
                  <th className="p-2 text-center">Final</th>
                  <th className="p-2">Comment</th>
                </tr>
              </thead>
              <tbody>
                {competencies.map((c) => {
                  const final = finalRating(c.selfRating, c.mgrRating, c.panelRating);
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="min-w-[200px] p-2">
                        {c.groupName && <div className="text-[10px] font-bold uppercase tracking-wide text-ink2">{c.groupName}</div>}
                        <div className="font-medium text-ink">{c.name}</div>
                      </td>
                      <td className="min-w-[80px] p-2">
                        {view === "self" ? (
                          <RatingSelect
                            key={`${c.id}:self:${c.selfRating ?? ""}`}
                            value={c.selfRating}
                            disabled={!editable}
                            onSave={(v) => saveCompRating(c.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={c.selfRating} />
                        )}
                      </td>
                      <td className="min-w-[80px] p-2">
                        {view === "mgr" ? (
                          <RatingSelect
                            key={`${c.id}:mgr:${c.mgrRating ?? ""}`}
                            value={c.mgrRating}
                            disabled={!editable}
                            onSave={(v) => saveCompRating(c.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={c.mgrRating} />
                        )}
                      </td>
                      <td className="min-w-[80px] p-2">
                        {view === "panel" ? (
                          <RatingSelect
                            key={`${c.id}:panel:${c.panelRating ?? ""}`}
                            value={c.panelRating}
                            disabled={!editable}
                            onSave={(v) => saveCompRating(c.id, v)}
                          />
                        ) : (
                          <ReadOnlyRating value={c.panelRating} />
                        )}
                      </td>
                      <td className="p-2 text-center font-bold text-ink">{final ?? "—"}</td>
                      <td className="min-w-[220px] p-2">
                        <EditableField
                          key={c.comment ?? ""}
                          value={c.comment ?? ""}
                          placeholder="Comment"
                          disabled={!canManagerRate && !canSelfAssess}
                          onSave={(v) => saveCompComment(c.id, v)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
