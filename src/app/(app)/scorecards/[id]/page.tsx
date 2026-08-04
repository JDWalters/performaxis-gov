import Link from "next/link";
import { notFound } from "next/navigation";
import { getScorecardDetail, type CaptureKpi } from "@/lib/data/scorecards";
import { saveKpiResult } from "../actions";

/** Friendly label for the canonical stored value - display only, never stored. */
function friendlyActual(kpi: CaptureKpi): string | null {
  const actual = kpi.result?.actual;
  if (!actual) return null;
  if (kpi.calc?.type === "yesno") {
    return actual === "1" ? "Achieved" : actual === "0" ? "Not achieved" : actual;
  }
  return actual;
}

export default async function ScorecardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/scorecards" className="text-xs font-semibold text-ink2 hover:underline">
            ← All scorecards
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-ink">{detail.orgName}</h1>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((qq) => (
            <Link
              key={qq}
              href={`/scorecards/${id}?q=${qq}`}
              prefetch={false}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                qq === quarter
                  ? "bg-ink text-white"
                  : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              Q{qq}
            </Link>
          ))}
        </div>
      </div>

      {!detail.canCapture && (
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You have view-only access to this scorecard.
        </p>
      )}

      {detail.kpis.length === 0 ? (
        <p className="text-sm text-ink2">No KPIs on this scorecard yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {detail.kpis.map((kpi) => (
            <div key={kpi.id} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {kpi.refCode && (
                      <span className="stag stag-pending text-[10px]">{kpi.refCode}</span>
                    )}
                    {kpi.kpa && (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink2">
                        {kpi.kpa}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold text-ink">{kpi.name}</div>
                  {kpi.unitOfMeasure && (
                    <div className="mt-0.5 text-xs text-ink2">{kpi.unitOfMeasure}</div>
                  )}
                </div>
                <div className="flex-none text-xs text-ink2 sm:text-right">
                  <div className="font-bold uppercase tracking-wide">Q{quarter} target</div>
                  <div className="mt-0.5 font-mono text-sm text-ink">{kpi.target ?? "—"}</div>
                </div>
              </div>

              {detail.canCapture ? (
                <form action={saveKpiResult} className="flex flex-col gap-3">
                  <input type="hidden" name="scorecardId" value={detail.scorecardId} />
                  <input type="hidden" name="scorecardKpiId" value={kpi.id} />
                  <input type="hidden" name="quarter" value={quarter} />

                  <CaptureInputs kpi={kpi} />

                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-ink2 group-open:text-ink">
                      Evidence, comment &amp; corrective action
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
                        Evidence URL
                        <input
                          type="text"
                          name="evidenceUrl"
                          defaultValue={kpi.result?.evidenceUrl ?? ""}
                          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
                        Comment
                        <textarea
                          name="comment"
                          defaultValue={kpi.result?.comment ?? ""}
                          rows={2}
                          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
                        Corrective action
                        <textarea
                          name="correctiveAction"
                          defaultValue={kpi.result?.correctiveAction ?? ""}
                          rows={2}
                          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </label>
                    </div>
                  </details>

                  <button
                    type="submit"
                    className="self-start rounded-md bg-ink px-4 py-1.5 text-xs font-bold text-white transition hover:bg-ink/90"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <div className="text-sm text-ink">
                  {friendlyActual(kpi) ?? "No result captured yet."}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

/**
 * Renders the right capture input(s) for this KPI's calc type instead of one
 * free-text box for every KPI - a Yes/No selector for "yesno" KPIs, numeric
 * fields for "single"/"ratio"/"three" KPIs (matching kpi_library.calc_config),
 * falling back to free text only for KPIs with no recognised calc type.
 */
function CaptureInputs({ kpi }: { kpi: CaptureKpi }) {
  const calc = kpi.calc;
  const inputs = kpi.result?.inputs ?? {};
  const currentLabel = friendlyActual(kpi);

  if (calc?.type === "yesno") {
    const current = kpi.result?.actual;
    return (
      <div className={LABEL_CLASS}>
        Achieved this quarter?
        <div className="mt-1 flex gap-4 text-sm font-normal text-ink">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="answer" value="1" defaultChecked={current === "1"} required />
            Yes (1)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="answer" value="0" defaultChecked={current === "0"} required />
            No (0)
          </label>
        </div>
      </div>
    );
  }

  if (calc?.type === "single") {
    return (
      <label className={LABEL_CLASS}>
        {calc.labels?.[0] ?? "Result value"}
        <input
          type="text"
          name="value"
          inputMode="decimal"
          defaultValue={(inputs.value as string) ?? kpi.result?.actual ?? ""}
          className={FIELD_CLASS}
        />
      </label>
    );
  }

  if (calc?.type === "ratio") {
    const hasFixedDen = typeof calc.den === "number";
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={`${LABEL_CLASS} flex-1`}>
          {calc.labels?.[0] ?? "Numerator"}
          <input
            type="text"
            name="numerator"
            inputMode="decimal"
            defaultValue={(inputs.numerator as string) ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        {hasFixedDen ? (
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
              name="denominator"
              inputMode="decimal"
              defaultValue={(inputs.denominator as string) ?? ""}
              className={FIELD_CLASS}
            />
          </label>
        )}
        {currentLabel && (
          <div className="text-xs text-ink2 sm:self-end sm:pb-2">Current: {currentLabel}</div>
        )}
      </div>
    );
  }

  if (calc?.type === "three") {
    const keys = ["a", "b", "c"] as const;
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        {keys.map((key, i) => (
          <label key={key} className={`${LABEL_CLASS} flex-1`}>
            {calc.labels?.[i] ?? key.toUpperCase()}
            <input
              type="text"
              name={key}
              inputMode="decimal"
              defaultValue={(inputs[key] as string) ?? ""}
              className={FIELD_CLASS}
            />
          </label>
        ))}
      </div>
    );
  }

  // No recognised calc type on this KPI - fall back to the original free-text box.
  return (
    <label className={LABEL_CLASS}>
      Actual
      <input
        type="text"
        name="actual"
        defaultValue={kpi.result?.actual ?? ""}
        placeholder="e.g. 80.78%"
        className={FIELD_CLASS}
      />
    </label>
  );
}
