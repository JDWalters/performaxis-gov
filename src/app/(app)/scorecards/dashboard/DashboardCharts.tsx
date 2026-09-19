import { STATUS_META, type Status, type StatusTally } from "@/lib/data/sdbip-status";

const ORDER: Status[] = ["blue", "met", "almost", "missed", "pending"];
const COLOR_VAR: Record<Status, string> = {
  blue: "var(--color-blue)",
  met: "var(--color-met)",
  almost: "var(--color-almost)",
  missed: "var(--color-missed)",
  pending: "var(--color-pending)",
};

function total(t: StatusTally): number {
  return ORDER.reduce((sum, s) => sum + t[s], 0);
}

/**
 * 5-segment conic-gradient donut - a plain ring, no text inside. Matches the
 * client reference's approach of keeping the donut as a compact visual
 * indicator and putting the actual percentage next to it as its own big,
 * bold callout (see BigStat below) instead of squeezing it into the hole.
 */
export function DonutChart({ tally }: { tally: StatusTally }) {
  const t = total(tally);
  let acc = 0;
  const stops =
    t === 0
      ? "var(--color-pending) 0% 100%"
      : ORDER.map((s) => {
          const from = (acc / t) * 100;
          acc += tally[s];
          const to = (acc / t) * 100;
          return `${COLOR_VAR[s]} ${from}% ${to}%`;
        }).join(", ");

  return (
    <div className="relative h-24 w-24 flex-none rounded-full" style={{ background: `conic-gradient(${stops})` }}>
      <div className="absolute inset-[18%] rounded-full bg-white" />
    </div>
  );
}

/** The big, high-contrast percentage callout that sits beside the donut. */
export function BigStat({ pctAchieved, caption, dark = false }: { pctAchieved: number | null; caption: string; dark?: boolean }) {
  return (
    <div>
      <div className={`text-4xl font-extrabold leading-none sm:text-5xl ${dark ? "text-white" : "text-ink"}`}>
        {pctAchieved ?? "—"}%
      </div>
      <div className={`mt-1.5 text-sm ${dark ? "text-white/70" : "text-ink2"}`}>{caption}</div>
    </div>
  );
}

/** Horizontal stacked bar showing the same 5-tier breakdown, with a text legend below. */
export function StatusBar({
  tally,
  compact = false,
  dark = false,
}: {
  tally: StatusTally;
  compact?: boolean;
  dark?: boolean;
}) {
  const t = total(tally);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex w-full overflow-hidden rounded-full ${compact ? "h-2" : "h-3"} ${dark ? "bg-white/10" : "bg-paper"}`}
      >
        {t === 0 ? (
          <div className="h-full w-full" style={{ background: COLOR_VAR.pending }} />
        ) : (
          ORDER.map((s) =>
            tally[s] > 0 ? (
              <div key={s} style={{ width: `${(tally[s] / t) * 100}%`, background: COLOR_VAR[s] }} />
            ) : null
          )
        )}
      </div>
      {!compact && (
        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium sm:text-sm ${dark ? "text-white/90" : "text-ink2"}`}
        >
          {ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COLOR_VAR[s] }} />
              {STATUS_META[s].label} {tally[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 4-column quarter-by-quarter trend strip, current quarter highlighted. */
export function QuarterTrend({
  trend,
  currentQuarter,
  dark = false,
}: {
  trend: { quarter: number; pct: number | null }[];
  currentQuarter: number | null;
  dark?: boolean;
}) {
  const max = Math.max(10, ...trend.map((q) => q.pct ?? 0));
  const labelClass = dark ? "text-white" : "text-ink2";
  return (
    <div className="flex items-end gap-4">
      {trend.map((q) => (
        <div key={q.quarter} className="flex flex-col items-center gap-1">
          <span className={`text-xs font-bold ${labelClass}`}>{q.pct == null ? "—" : `${q.pct}%`}</span>
          <div
            className={`w-8 rounded-t-sm ${q.quarter === currentQuarter ? "bg-gold" : "bg-[var(--color-met)]"}`}
            style={{ height: `${Math.max(6, ((q.pct ?? 0) / max) * 64)}px` }}
          />
          <span className={`text-[11px] font-semibold ${labelClass}`}>Q{q.quarter}</span>
        </div>
      ))}
    </div>
  );
}
