"use client";

/**
 * Clause 12.1 standing report - ported from views.js's reports(). Decisions
 * taken under delegation in a date range, grouped by the org's reporting
 * categories, with a print button and a bulk "mark all as reported" action.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateDecision, MandateEntry, MandateOrg, AuthorityMap } from "@/lib/data/mandate-shared";
import { mandateMoney } from "@/lib/data/mandate-shared";
import { markDecisionsReported } from "./actions";

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

export function ReportsClient({
  org,
  entries,
  authorities,
  decisions,
  canMark,
}: {
  org: MandateOrg;
  entries: MandateEntry[];
  authorities: AuthorityMap;
  decisions: MandateDecision[];
  canMark: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const rows = useMemo(
    () =>
      decisions.filter((d) => {
        if (from && (d.decidedOn || "") < from) return false;
        if (to && (d.decidedOn || "") > to) return false;
        return true;
      }),
    [decisions, from, to]
  );

  function lastSixMonths() {
    const t = new Date();
    setTo(t.toISOString().slice(0, 10));
    t.setMonth(t.getMonth() - 6);
    setFrom(t.toISOString().slice(0, 10));
  }

  const unreported = rows.filter((d) => !d.reportedOn);

  function markAll() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orgId", org.id);
      fd.set("ids", JSON.stringify(unreported.map((d) => d.id)));
      await markDecisionsReported(fd);
      router.refresh();
    });
  }

  const uncategorised = rows.filter((d) => !d.category);

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="phead">
        <div>
          <div className="eyebrow gold">Clause 12.1</div>
          <h1 className="serif">Standing report to {org.governingBody || "the governing body"}</h1>
        </div>
        <div className="btnrow noprint">
          <button type="button" className="btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
      <p className="pnote">Decisions taken under delegation in the period, grouped by the reporting categories in the instrument.</p>

      <div className="filters noprint">
        <div className="f">
          <span>From</span>
          <input type="date" value={from} onChange={(ev) => setFrom(ev.target.value)} />
        </div>
        <div className="f">
          <span>To</span>
          <input type="date" value={to} onChange={(ev) => setTo(ev.target.value)} />
        </div>
        <button type="button" className="btn" onClick={lastSixMonths}>
          Last 6 months
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-b">
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 14 }}>
            <div className="muted small">Organisation</div>
            <div>{org.name}</div>
            <div className="muted small">Period</div>
            <div>
              {from ? fmtDate(from) : "the beginning"} to {to ? fmtDate(to) : "today"}
            </div>
            <div className="muted small">Decisions</div>
            <div>{rows.length}</div>
            <div className="muted small">Prepared</div>
            <div>{fmtDate(today)}</div>
          </div>
        </div>
      </div>

      {org.categories.map((c) => {
        const set = rows
          .filter((d) => d.category === c.id)
          .slice()
          .sort((a, b) => (a.decidedOn || "").localeCompare(b.decidedOn || ""));
        return (
          <div key={c.id} style={{ marginBottom: 20 }}>
            <h3 className="serif" style={{ margin: "20px 0 8px", fontSize: 15 }}>
              {c.label} ({set.length})
            </h3>
            {set.length === 0 ? (
              <p className="small muted">Nothing to report in this category.</p>
            ) : (
              <div className="tw">
                <table className="reg">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref</th>
                      <th>Decision</th>
                      <th>Taken by</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {set.map((d) => {
                      const e = d.entryId ? entryById.get(d.entryId) : null;
                      const taker = d.takenById ? authorities.get(d.takenById) : null;
                      return (
                        <tr key={d.id}>
                          <td className="mono small nowrap">{d.decidedOn}</td>
                          <td className="ref">{e?.ref || ""}</td>
                          <td>
                            <div>{d.summary}</div>
                            {d.note && <div className="small muted">{d.note}</div>}
                          </td>
                          <td>{taker ? taker.name : ""}</td>
                          <td className="nowrap right">{d.amount != null ? mandateMoney(d.amount) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {uncategorised.length > 0 && (
        <>
          <h3 className="serif" style={{ margin: "20px 0 8px", fontSize: 15 }}>
            Not categorised ({uncategorised.length})
          </h3>
          <p className="small muted">
            These decisions have no reporting category and will not appear under a heading above. Open each one and set a
            category.
          </p>
        </>
      )}

      {unreported.length > 0 && canMark && (
        <div className="noprint" style={{ marginTop: 20 }}>
          <button type="button" className="btn pri" disabled={pending} onClick={markAll}>
            Mark all {unreported.length} as reported today
          </button>
        </div>
      )}
    </div>
  );
}
