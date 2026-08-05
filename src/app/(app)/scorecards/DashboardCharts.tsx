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

/** 5-segment conic-gradient donut with a center label, matching the reference dashboard's summary chart. */
export function DonutChart({ tally, pctAchieved }: { tally: StatusTally; pctAchieved: number | null }) {
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
    <div className="relative h-36 w-36 flex-none rounded-full" style={{ background: `conic-gradient(${stops})` }}>
      <div className="absolute inset-[14%] flex flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-2xl font-extrabold text-ink">{pctAchieved ?? "—"}%</span>
      </div>
    </div>
  );
}

/** Horizontal stacked bar showing the same 5-tier breakdown, with a text legend below. */
export function StatusBar({ tally, compact = false }: { tally: StatusTally; compact?: boolean }) {
  const t = total(tally);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-paper">
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
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink2">
          {ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_VAR[s] }} />
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
}: {
  trend: { quarter: number; pct: number | null }[];
  currentQuarter: number | null;
}) {
  const max = Math.max(10, ...trend.map((q) => q.pct ?? 0));
  return (
    <div className="flex items-end gap-4">
      {trend.map((q) => (
        <div key={q.quarter} className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-ink2">{q.pct == null ? "—" : `${q.pct}%`}</span>
          <div
            className={`w-8 rounded-t-sm ${q.quarter === currentQuarter ? "bg-gold" : "bg-[var(--color-met)]"}`}
            style={{ height: `${Math.max(6, ((q.pct ?? 0) / max) * 64)}px` }}
          />
          <span className="text-[11px] font-semibold text-ink2">Q{q.quarter}</span>
        </div>
      ))}
    </div>
  );
}
