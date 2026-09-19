/**
 * Minimal hand-rolled sparkline (no chart library, matching the dashboard's
 * hand-rolled donut) - plots a quarter-by-quarter percentage trend, skipping
 * null quarters instead of treating them as zero, and breaking the line
 * across any gap so an unreportable quarter doesn't fake a data point.
 */
export function Sparkline({
  values,
  width = 128,
  height = 40,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
}) {
  const pad = 6;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const n = Math.max(1, values.length - 1);

  const points = values.map((v, i) =>
    v == null ? null : { x: pad + (i / n) * usableW, y: pad + usableH - (Math.max(0, Math.min(100, v)) / 100) * usableH }
  );

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const p of points) {
    if (p) current.push(p);
    else {
      if (current.length) segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  if (segments.length === 0) {
    return (
      <svg width={width} height={height} className="flex-none">
        <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="var(--color-line)" strokeWidth="2" strokeDasharray="3,3" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="flex-none">
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {points.map(
        (p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--color-gold)" />
      )}
    </svg>
  );
}
