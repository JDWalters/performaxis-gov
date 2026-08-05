/**
 * Shown above a capture card when the stored `actual` doesn't match the KPI's
 * answer type - a legacy free-text value (e.g. "Submitted on time", "Error in
 * claculation") typed before this KPI had a structured form. For yesno/ratio/
 * three-input KPIs the structured fields below this banner will be blank
 * (they read from a separate `inputs` field the legacy value never
 * populated), so without this the original value would be invisible on
 * screen even though it's still safely in the database.
 */
export function NeedsReviewBanner({ rawValue }: { rawValue: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink">
        <span aria-hidden>⚠</span> Needs review
      </div>
      <p className="text-xs text-ink2">
        This result was captured before this KPI had a structured answer type, so it isn&apos;t
        showing correctly below. Originally captured:{" "}
        <span className="font-semibold text-ink">&ldquo;{rawValue}&rdquo;</span> - please re-enter
        it using the fields below.
      </p>
    </div>
  );
}
