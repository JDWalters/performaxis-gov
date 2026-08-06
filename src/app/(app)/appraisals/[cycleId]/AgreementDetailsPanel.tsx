"use client";

import { useRef, useState, useTransition } from "react";
import { saveAgreementTemplateField } from "./agreement-template-actions";
import type { ReviewScheduleRow } from "@/lib/data/agreement";

const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-paper disabled:text-ink2";

/** Free-text field that only saves onBlur if it actually changed. */
function TemplateField({
  value,
  onSave,
  placeholder,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);
  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        setLocal(e.target.value);
        dirtyRef.current = true;
      }}
      onBlur={() => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        onSave(local);
      }}
      className={CELL_CLASS}
    />
  );
}

/**
 * The reference tool's "Details inserted into the agreement" panel, plus a
 * live preview of the document those details feed - both were missing
 * entirely; the app only had a "Print Performance Agreement" link out to a
 * separate route. These three fields (place/day/month) and the four
 * quarterly review-due dates are municipality-wide template values (every
 * employee's agreement text uses the same ones), not per-employee data -
 * writing to policy_templates.config, gated by manage_org_setup, same as
 * EPAS Setup. The preview is the actual print route rendered in an iframe
 * (with ?embed=1 to suppress the print button/auto-print), so it's always
 * pixel-identical to what actually prints - a manual refresh button reloads
 * it after an edit, since the iframe doesn't auto-revalidate.
 */
export function AgreementDetailsPanel({
  cycleId,
  municipalityOrgId,
  canEdit,
  signPlaceDefault,
  signDayDefault,
  signMonthDefault,
  reviewSchedule,
  reviewDates,
}: {
  cycleId: string;
  municipalityOrgId: string | null;
  canEdit: boolean;
  signPlaceDefault: string | null;
  signDayDefault: string | null;
  signMonthDefault: string | null;
  reviewSchedule: ReviewScheduleRow[];
  reviewDates: [string | null, string | null, string | null, string | null];
}) {
  const [, startTransition] = useTransition();
  const [previewKey, setPreviewKey] = useState(0);

  const save = (field: string, value: string) => {
    if (!municipalityOrgId) return;
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("orgId", municipalityOrgId);
    fd.set("field", field);
    fd.set("value", value);
    startTransition(() => saveAgreementTemplateField(fd));
    // The iframe below is a separate, fully server-rendered document - it
    // doesn't share Next.js's router cache with this page, so nudge it to
    // reload a beat after the save lands.
    setTimeout(() => setPreviewKey((k) => k + 1), 400);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-white p-4">
        <h3 className="mb-1 text-sm font-extrabold text-ink">Details inserted into the agreement</h3>
        <p className="mb-3 text-xs text-ink2">
          These apply to every employee&apos;s agreement at this municipality - the place, day and month the
          agreement is concluded, and each quarter&apos;s review-due date (clause 7).
          {!canEdit && " You have view-only access to these."}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
            Place of signature
            <TemplateField
              key={signPlaceDefault ?? ""}
              value={signPlaceDefault ?? ""}
              placeholder="e.g. Trompsburg"
              disabled={!canEdit}
              onSave={(v) => save("signPlaceDefault", v)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
            Day of signature
            <TemplateField
              key={signDayDefault ?? ""}
              value={signDayDefault ?? ""}
              placeholder="e.g. 24th"
              disabled={!canEdit}
              onSave={(v) => save("signDayDefault", v)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
            Month and year of signature
            <TemplateField
              key={signMonthDefault ?? ""}
              value={signMonthDefault ?? ""}
              placeholder="e.g. July 2026"
              disabled={!canEdit}
              onSave={(v) => save("signMonthDefault", v)}
            />
          </label>
        </div>

        <div className="mt-4 text-xs font-bold uppercase tracking-wide text-ink2">
          Assessment dates — inserted into the schedule for performance reviews (clause 7)
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-4">
          {reviewSchedule.map((r, i) => (
            <label key={r.quarter} className="flex flex-col gap-1 text-xs font-semibold text-ink2">
              Q{r.quarter} — {r.reviewType}
              <TemplateField
                key={reviewDates[i] ?? ""}
                value={reviewDates[i] ?? ""}
                placeholder={r.dueDate}
                disabled={!canEdit}
                onSave={(v) => save(`reviewDate${i}`, v)}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink2">
          Leave an assessment date blank to use the default shown. Changes appear in the agreement below and on the
          printed copy immediately.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-ink">Agreement preview</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
            >
              ↻ Refresh preview
            </button>
            <a
              href={`/appraisals/${cycleId}/agreement`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90"
            >
              Print / save the agreement ↗
            </a>
          </div>
        </div>
        <iframe
          key={previewKey}
          src={`/appraisals/${cycleId}/agreement?embed=1`}
          title="Performance agreement preview"
          className="w-full rounded-lg border border-line"
          style={{ height: "80vh" }}
        />
      </div>
    </div>
  );
}
