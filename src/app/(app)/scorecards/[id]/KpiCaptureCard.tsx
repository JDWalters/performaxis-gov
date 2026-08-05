"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveKpiResult } from "../actions";
import {
  computeCalcResult,
  friendlyActual,
  friendlyActualValue,
  kpiNeedsReview,
  type CaptureKpi,
} from "@/lib/data/scorecards-shared";
import { statusFor, STATUS_META, type Status } from "@/lib/data/sdbip-status";
import { NeedsReviewBanner } from "@/components/NeedsReviewBanner";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
// Separate (non-composed) variant for required-but-empty fields, so we never
// mix conflicting border-color utilities (border-line + border-missed) in one
// className string - Tailwind's cascade order there isn't guaranteed to match
// class-list order, so the two must be mutually exclusive strings instead.
const FIELD_CLASS_REQUIRED =
  "rounded-md border border-missed bg-missed-bg/30 px-3 py-1.5 text-sm text-ink outline-none focus:border-missed focus:ring-2 focus:ring-missed/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";
const DEBOUNCE_MS = 900;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function StatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") return <span className="text-xs text-ink2">Saving…</span>;
  if (status === "error")
    return <span className="text-xs font-semibold text-missed">Couldn&apos;t save — check connection</span>;
  return <span className="text-xs font-semibold text-met">Saved</span>;
}

/** Border/background for the evidence section - a quiet signal of where this KPI currently stands. */
const SECTION_TONE: Record<"missed" | "achieved" | "neutral", string> = {
  missed: "border border-missed bg-missed-bg/40 p-2",
  achieved: "border border-met bg-met-bg/40 p-2",
  neutral: "",
};

/**
 * Live "calculated result" panel - mirrors the client reference's big
 * right-hand result display. Always reflects whatever's currently typed
 * (not just the last-saved value), so it updates as the capturer works.
 */
function ResultPanel({
  liveLabel,
  liveStatus,
  saveStatus,
  savedLabel,
}: {
  liveLabel: string | null;
  liveStatus: Status;
  saveStatus: SaveStatus;
  savedLabel: string | null;
}) {
  return (
    <div className="flex flex-none flex-col gap-2 rounded-lg border border-line bg-paper p-3 sm:w-48">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink2">Calculated result</div>
      <div className="font-mono text-xl font-extrabold text-ink">{liveLabel ?? "—"}</div>
      <span className={`stag ${STATUS_META[liveStatus].tagClass} w-fit text-[10px]`}>
        {STATUS_META[liveStatus].label}
      </span>
      <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-2">
        {savedLabel && <span className="text-[11px] text-ink2">Saved: {savedLabel}</span>}
        <StatusPill status={saveStatus} />
      </div>
    </div>
  );
}

/**
 * Autosaving capture card for one KPI's quarter result. Fields save
 * themselves (debounced while typing, immediately on Yes/No selection) so
 * capturers aren't clicking Save dozens of times per department per quarter -
 * the right-hand ResultPanel plays the role of the client reference's manual
 * "Save to Q_" button, just reflecting state instead of triggering it.
 */
export function KpiCaptureCard({
  kpi,
  quarter,
  scorecardId,
}: {
  kpi: CaptureKpi;
  quarter: number;
  scorecardId: string;
}) {
  const calc = kpi.calc;
  const inputs = kpi.result?.inputs ?? {};

  const [answer, setAnswer] = useState(kpi.result?.actual ?? "");
  const [rating, setRating] = useState(kpi.result?.actual ?? "");
  // `inputs` is a jsonb blob - historically the ratio/three/rating branches of
  // computeCalcResult() stored these as JS numbers (Number(...)), not
  // strings. An unsafe `as string` cast here left the number in place, and
  // any later .trim() call on it (e.g. inside computeCalcResult while
  // recomputing the live result) throws "x.trim is not a function". Coerce
  // properly instead of casting.
  const toStr = (v: unknown): string => (v == null ? "" : String(v));
  const [value, setValue] = useState(inputs.value != null ? toStr(inputs.value) : (kpi.result?.actual ?? ""));
  const [numerator, setNumerator] = useState(toStr(inputs.numerator));
  const [denominator, setDenominator] = useState(toStr(inputs.denominator));
  const [a, setA] = useState(toStr(inputs.a));
  const [b, setB] = useState(toStr(inputs.b));
  const [c, setC] = useState(toStr(inputs.c));
  const [fallbackActual, setFallbackActual] = useState(kpi.result?.actual ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(kpi.result?.evidenceUrl ?? "");
  const [comment, setComment] = useState(kpi.result?.comment ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(kpi.result?.correctiveAction ?? "");

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function doSave(overrides: Record<string, string>) {
    const fd = new FormData();
    fd.set("scorecardId", scorecardId);
    fd.set("scorecardKpiId", kpi.id);
    fd.set("quarter", String(quarter));
    const all: Record<string, string> = {
      answer,
      rating,
      value,
      numerator,
      denominator,
      a,
      b,
      c,
      actual: fallbackActual,
      evidenceUrl,
      comment,
      correctiveAction,
      ...overrides,
    };
    for (const [k, v] of Object.entries(all)) fd.set(k, v);

    setStatus("saving");
    startTransition(async () => {
      try {
        await saveKpiResult(fd);
        setStatus("saved");
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
      }
    });
  }

  /** Debounced save for text/numeric fields - waits for a pause in typing. */
  function scheduleSave(overrides: Record<string, string>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(overrides), DEBOUNCE_MS);
  }

  /** Immediate save - used for discrete choices (Yes/No) and on blur. */
  function saveNow(overrides: Record<string, string>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave(overrides);
  }

  const savedLabel = friendlyActual(kpi);
  const flagged = kpiNeedsReview(kpi);

  // Live "target not met" / "target achieved" check - recomputed from
  // whatever's currently typed (not just the last-saved actual), so the
  // ResultPanel and required-fields warning react immediately as the
  // capturer fills in the form, before the debounced save even fires.
  const liveGet = (key: string): string =>
    ({ answer, rating, value, numerator, denominator, a, b, c, actual: fallbackActual })[key] ?? "";
  const liveActual = computeCalcResult(calc, liveGet).actual;
  const liveLabel = friendlyActualValue(liveActual, calc);
  const liveStatus = liveActual ? statusFor(liveActual, kpi.target, kpi.lower) : "pending";
  const notMet = liveStatus === "missed" || liveStatus === "almost";
  const achieved = liveStatus === "met" || liveStatus === "blue";
  const commentMissing = notMet && !comment.trim();
  const correctiveMissing = notMet && !correctiveAction.trim();
  const sectionTone = notMet ? SECTION_TONE.missed : achieved ? SECTION_TONE.achieved : SECTION_TONE.neutral;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-3">
        {flagged && kpi.result?.actual && <NeedsReviewBanner rawValue={kpi.result.actual} />}

        {calc?.type === "yesno" && (
          <div className={LABEL_CLASS}>
            Achieved this quarter?
            <div className="mt-1 flex items-center gap-4 text-sm font-normal text-ink">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={answer === "1"}
                  onChange={() => {
                    setAnswer("1");
                    saveNow({ answer: "1" });
                  }}
                />
                Yes (1)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={answer === "0"}
                  onChange={() => {
                    setAnswer("0");
                    saveNow({ answer: "0" });
                  }}
                />
                No (0)
              </label>
            </div>
          </div>
        )}

        {calc?.type === "rating" && (
          <div className={LABEL_CLASS}>
            {calc.labels?.[0] ?? "Rating"}
            <div className="mt-1 flex items-center gap-1.5 text-sm font-normal text-ink">
              {Array.from({ length: calc.scale ?? 5 }, (_, i) => String(i + 1)).map((n) => (
                <label key={n} className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={rating === n}
                    onChange={() => {
                      setRating(n);
                      saveNow({ rating: n });
                    }}
                  />
                  {n}
                </label>
              ))}
            </div>
          </div>
        )}

        {calc?.type === "single" && (
          <label className={LABEL_CLASS}>
            {calc.labels?.[0] ?? "Result value"}
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                scheduleSave({ value: e.target.value });
              }}
              onBlur={() => saveNow({ value })}
              className={FIELD_CLASS}
            />
          </label>
        )}

        {calc?.type === "ratio" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className={`${LABEL_CLASS} flex-1`}>
              {calc.labels?.[0] ?? "Numerator"}
              <input
                type="text"
                inputMode="decimal"
                value={numerator}
                onChange={(e) => {
                  setNumerator(e.target.value);
                  scheduleSave({ numerator: e.target.value });
                }}
                onBlur={() => saveNow({ numerator })}
                className={FIELD_CLASS}
              />
            </label>
            {typeof calc.den === "number" ? (
              <div className={`${LABEL_CLASS} flex-1`}>
                {calc.labels?.[1] ?? "Denominator"}
                <div className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink2">
                  {calc.den} (fixed)
                </div>
              </div>
            ) : (
              <label className={`${LABEL_CLASS} flex-1`}>
                {calc.labels?.[1] ?? "Denominator"}
                <input
                  type="text"
                  inputMode="decimal"
                  value={denominator}
                  onChange={(e) => {
                    setDenominator(e.target.value);
                    scheduleSave({ denominator: e.target.value });
                  }}
                  onBlur={() => saveNow({ denominator })}
                  className={FIELD_CLASS}
                />
              </label>
            )}
          </div>
        )}

        {calc?.type === "three" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {(
              [
                ["a", a, setA],
                ["b", b, setB],
                ["c", c, setC],
              ] as const
            ).map(([key, val, setter], i) => (
              <label key={key} className={`${LABEL_CLASS} flex-1`}>
                {calc.labels?.[i] ?? key.toUpperCase()}
                <input
                  type="text"
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => {
                    setter(e.target.value);
                    scheduleSave({ [key]: e.target.value });
                  }}
                  onBlur={() => saveNow({ [key]: val })}
                  className={FIELD_CLASS}
                />
              </label>
            ))}
          </div>
        )}

        {!calc?.type ||
        !["yesno", "rating", "single", "ratio", "three"].includes(calc.type) ? (
          <label className={LABEL_CLASS}>
            Actual
            <input
              type="text"
              value={fallbackActual}
              placeholder="e.g. 80.78%"
              onChange={(e) => {
                setFallbackActual(e.target.value);
                scheduleSave({ actual: e.target.value });
              }}
              onBlur={() => saveNow({ actual: fallbackActual })}
              className={FIELD_CLASS}
            />
          </label>
        ) : null}

        {notMet && (
          <div className="rounded-md border border-missed bg-missed-bg px-3 py-1.5 text-xs font-semibold text-missed">
            Target not met — Performance Comment and Corrective Action below are required before this result is
            complete.
          </div>
        )}
        {achieved && (
          <div className="rounded-md border border-met bg-met-bg px-3 py-1.5 text-xs font-semibold text-met">
            Target achieved.
          </div>
        )}

        <details
          open={detailsOpen || commentMissing || correctiveMissing}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
          className={`group rounded-lg ${sectionTone}`}
        >
          <summary
            className={`cursor-pointer text-xs font-semibold ${
              notMet ? "text-missed" : achieved ? "text-met" : "text-ink2 group-open:text-ink"
            }`}
          >
            Evidence, comment &amp; corrective action
            {notMet && <span className="ml-1 font-bold">— required</span>}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <label className={LABEL_CLASS}>
              Evidence URL
              <input
                type="text"
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  scheduleSave({ evidenceUrl: e.target.value });
                }}
                onBlur={() => saveNow({ evidenceUrl })}
                className={FIELD_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Comment {notMet && <span className="text-missed">*</span>}
              <textarea
                value={comment}
                rows={2}
                required={notMet}
                onChange={(e) => {
                  setComment(e.target.value);
                  scheduleSave({ comment: e.target.value });
                }}
                onBlur={() => saveNow({ comment })}
                className={commentMissing ? FIELD_CLASS_REQUIRED : FIELD_CLASS}
              />
              {commentMissing && <span className="text-[11px] font-semibold text-missed">Required — target not met</span>}
            </label>
            <label className={LABEL_CLASS}>
              Corrective action {notMet && <span className="text-missed">*</span>}
              <textarea
                value={correctiveAction}
                rows={2}
                required={notMet}
                onChange={(e) => {
                  setCorrectiveAction(e.target.value);
                  scheduleSave({ correctiveAction: e.target.value });
                }}
                onBlur={() => saveNow({ correctiveAction })}
                className={correctiveMissing ? FIELD_CLASS_REQUIRED : FIELD_CLASS}
              />
              {correctiveMissing && (
                <span className="text-[11px] font-semibold text-missed">Required — target not met</span>
              )}
            </label>
          </div>
        </details>
      </div>

      <ResultPanel liveLabel={liveLabel} liveStatus={liveStatus} saveStatus={status} savedLabel={savedLabel} />
    </div>
  );
}
