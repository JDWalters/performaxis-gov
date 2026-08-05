"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveAppraisalResult } from "../actions";
import { friendlyAppraisalActual, appraisalKpiNeedsReview, type AppraisalKpi } from "@/lib/data/appraisals-shared";
import { NeedsReviewBanner } from "@/components/NeedsReviewBanner";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
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

/**
 * Autosaving capture card for one appraisal KPI's quarter result. Mirrors
 * scorecards/[id]/KpiCaptureCard.tsx exactly (same 5-type calc engine), plus
 * a read-only strip showing self/manager/panel ratings when present - those
 * come from a separate multi-rater sign-off workflow this form doesn't edit.
 */
export function AppraisalCaptureCard({
  kpi,
  quarter,
  cycleId,
}: {
  kpi: AppraisalKpi;
  quarter: number;
  cycleId: string;
}) {
  const calc = kpi.calc;
  const inputs = kpi.result?.inputs ?? {};

  const [answer, setAnswer] = useState(kpi.result?.actual ?? "");
  const [rating, setRating] = useState(kpi.result?.actual ?? "");
  const [value, setValue] = useState((inputs.value as string) ?? kpi.result?.actual ?? "");
  const [numerator, setNumerator] = useState((inputs.numerator as string) ?? "");
  const [denominator, setDenominator] = useState((inputs.denominator as string) ?? "");
  const [a, setA] = useState((inputs.a as string) ?? "");
  const [b, setB] = useState((inputs.b as string) ?? "");
  const [c, setC] = useState((inputs.c as string) ?? "");
  const [fallbackActual, setFallbackActual] = useState(kpi.result?.actual ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(kpi.result?.evidenceUrl ?? "");
  const [comment, setComment] = useState(kpi.result?.comment ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(kpi.result?.correctiveAction ?? "");

  const [status, setStatus] = useState<SaveStatus>("idle");
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
    fd.set("cycleId", cycleId);
    fd.set("appraisalKpiId", kpi.id);
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
        await saveAppraisalResult(fd);
        setStatus("saved");
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
      }
    });
  }

  function scheduleSave(overrides: Record<string, string>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(overrides), DEBOUNCE_MS);
  }

  function saveNow(overrides: Record<string, string>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave(overrides);
  }

  const currentLabel = friendlyAppraisalActual(kpi);
  const ratings = [
    ["Self", kpi.result?.selfRating],
    ["Manager", kpi.result?.mgrRating],
    ["Panel", kpi.result?.panelRating],
  ] as const;
  const hasRatings = ratings.some(([, v]) => v != null);
  const flagged = appraisalKpiNeedsReview(kpi);

  return (
    <div className="flex flex-col gap-3">
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
            <StatusPill status={status} />
          </div>
        </div>
      )}

      {calc?.type === "rating" && (
        <div className={LABEL_CLASS}>
          {calc.labels?.[0] ?? "Rating"}
          <div className="mt-1 flex items-center gap-3 text-sm font-normal text-ink">
            <div className="flex items-center gap-1.5">
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
            <StatusPill status={status} />
          </div>
        </div>
      )}

      {calc?.type === "single" && (
        <label className={LABEL_CLASS}>
          {calc.labels?.[0] ?? "Result value"}
          <div className="flex items-center gap-2">
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
            <StatusPill status={status} />
          </div>
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
          <div className="flex items-center gap-2 pb-2 text-xs text-ink2">
            {currentLabel && <span>Current: {currentLabel}</span>}
            <StatusPill status={status} />
          </div>
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
          <div className="pb-2">
            <StatusPill status={status} />
          </div>
        </div>
      )}

      {!calc?.type ||
      !["yesno", "rating", "single", "ratio", "three"].includes(calc.type) ? (
        <label className={LABEL_CLASS}>
          Actual
          <div className="flex items-center gap-2">
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
            <StatusPill status={status} />
          </div>
        </label>
      ) : null}

      {hasRatings && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-paper px-3 py-2 text-xs text-ink2">
          <span className="font-bold uppercase tracking-wide">Sign-off ratings</span>
          {ratings.map(([label, v]) =>
            v != null ? (
              <span key={label}>
                {label}: <span className="font-semibold text-ink">{v}/5</span>
              </span>
            ) : null
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-ink2 group-open:text-ink">
          Evidence, comment &amp; corrective action
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
            Comment
            <textarea
              value={comment}
              rows={2}
              onChange={(e) => {
                setComment(e.target.value);
                scheduleSave({ comment: e.target.value });
              }}
              onBlur={() => saveNow({ comment })}
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Corrective action
            <textarea
              value={correctiveAction}
              rows={2}
              onChange={(e) => {
                setCorrectiveAction(e.target.value);
                scheduleSave({ correctiveAction: e.target.value });
              }}
              onBlur={() => saveNow({ correctiveAction })}
              className={FIELD_CLASS}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
