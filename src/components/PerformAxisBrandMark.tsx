/**
 * The SDBIP reference tool's own header - literally, on every one of its
 * pages (Dashboard, Performance progress, Capture & calculate) - carries a
 * right-aligned PerformAxis wordmark + tagline block (.pxbrand/.pxname/
 * .pxtag1/.pxtag2 in the source CSS: 32px two-tone wordmark, gold 12px
 * "ALIGN · CASCADE · DELIVER", 11.5px slate tagline underneath). The EPAS
 * reference tool doesn't repeat this - it only marks pages with a small
 * corner icon - so this only belongs on the SDBIP-side screens that mirror
 * it (Scorecards dashboard, scorecard detail, Performance Progress), not
 * globally; the global header logo already covers the "brand visible
 * everywhere" job for the rest of the app.
 */
export function PerformAxisBrandMark() {
  return (
    <div className="text-right leading-tight">
      <div className="text-[32px] font-semibold tracking-[2px] [font-family:Arial,Helvetica,sans-serif]">
        <span className="text-ink">Perform</span>
        <span className="text-gold">Axis</span>
      </div>
      <div className="mt-0.5 text-xs font-bold tracking-[2px] text-gold">ALIGN · CASCADE · DELIVER</div>
      <div className="mt-0.5 text-[11.5px] text-ink2">Link Strategy. Drive Performance. Deliver Results.</div>
    </div>
  );
}
