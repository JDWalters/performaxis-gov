"use client";

/**
 * Decision log (Clause 12) - read-only table (built in an earlier session)
 * plus the "Log decision" creation drawer, ported field-for-field from
 * assets/edit.js's drawDecision(). Same drawer/dsec shell as
 * admin/structure's StructureClient and instruments/InstrumentsClient.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateDecision, MandateOrg } from "@/lib/data/mandate-shared";
import { mandateMoney, type AuthorityMap } from "@/lib/data/mandate-shared";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import { saveDecision } from "./actions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Draft = {
  id: string;
  entryId: string;
  date: string;
  takenById: string;
  summary: string;
  note: string;
  amount: string;
  category: string;
  reportedOn: string;
};

function blank(): Draft {
  return { id: "", entryId: "", date: today(), takenById: "", summary: "", note: "", amount: "", category: "", reportedOn: "" };
}

export function DecisionsClient({
  org,
  orgs,
  currentOrgId,
  entries,
  authorities,
  authorityMap,
  decisions,
  canEdit,
}: {
  org: MandateOrg;
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  entries: MandateEntry[];
  authorities: { v: string; l: string }[];
  authorityMap: AuthorityMap;
  decisions: MandateDecision[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const categoryLabel = useMemo(() => new Map(org.categories.map((c) => [c.id, c.label])), [org.categories]);

  // Taken under any entry, sorted by ref - ported from drawDecision()'s entry picker (it does not filter by status).
  const sortedEntries = useMemo(() => entries.slice().sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })), [entries]);

  const selectedEntry = draft?.entryId ? entryById.get(draft.entryId) ?? null : null;

  function openNew() {
    setErr("");
    setDraft(blank());
  }

  function pickEntry(entryId: string) {
    if (!draft) return;
    const e = entryById.get(entryId);
    // Default the reporting category from the entry, the same way
    // drawDecision() does, but only if the user hasn't already set one.
    const category = e && e.reportingCategory && !draft.category ? e.reportingCategory : draft.category;
    setDraft({ ...draft, entryId, category });
  }

  function save() {
    if (!draft) return;
    setErr("");
    const fd = new FormData();
    fd.set("orgId", currentOrgId);
    fd.set("id", draft.id);
    fd.set("entryId", draft.entryId);
    fd.set("date", draft.date);
    fd.set("takenById", draft.takenById);
    fd.set("summary", draft.summary);
    fd.set("note", draft.note);
    fd.set("amount", draft.amount);
    fd.set("category", draft.category);
    fd.set("reportedOn", draft.reportedOn);
    startTransition(async () => {
      try {
        await saveDecision(fd);
        setDraft(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1300, margin: "0 auto" }}>
      <MandateOrgSwitcher orgs={orgs} currentOrgId={currentOrgId} basePath="/mandate/decisions" />

      <div className="phead">
        <div>
          <div className="eyebrow gold">Operate</div>
          <h1 className="serif">Decision log</h1>
        </div>
        {canEdit && (
          <div className="btnrow">
            <button type="button" className="btn pri" onClick={openNew}>
              Log decision
            </button>
          </div>
        )}
      </div>
      <p className="pnote">Individual decisions taken under a delegated power, with the amount, category and reporting status of each.</p>

      {decisions.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet.</h3>
          <p className="muted">No decisions have been logged for this register.</p>
          {canEdit && (
            <button type="button" className="btn pri" onClick={openNew} style={{ marginTop: 12 }}>
              Log decision
            </button>
          )}
        </div>
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
                <th>Category</th>
                <th>Reported</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => {
                const e = d.entryId ? entryById.get(d.entryId) : null;
                const taker = d.takenById ? authorityMap.get(d.takenById) : null;
                return (
                  <tr key={d.id}>
                    <td className="nowrap mono small">{d.decidedOn || "—"}</td>
                    <td className="ref">{e?.ref || "—"}</td>
                    <td>{d.summary}</td>
                    <td>{taker ? taker.name : "—"}</td>
                    <td className="nowrap right">{d.amount != null ? mandateMoney(d.amount) : ""}</td>
                    <td className="small">{d.category ? (categoryLabel.get(d.category) ?? d.category) : ""}</td>
                    <td>
                      {d.reportedOn ? <span className="pill accepted">{d.reportedOn}</span> : <span className="pill issued">Not yet</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && setDraft(null)}>
          <div className="drawer detail" role="dialog" aria-modal="true">
            <div className="drawer-h">
              <div>
                <div className="eyebrow gold">Decision log</div>
                <h2 className="serif">{draft.id ? "Decision" : "Log decision"}</h2>
              </div>
              <button type="button" className="x" aria-label="Close" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="drawer-b">
              <div className="dsec">
                <div className="dsec-h">Taken under</div>
                <select value={draft.entryId} onChange={(ev) => pickEntry(ev.target.value)}>
                  <option value="">Choose an entry…</option>
                  {sortedEntries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.ref} — {e.description.slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEntry?.status === "reserved" && (
                <div className="note b" style={{ marginBottom: 14 }}>
                  <strong>This power is reserved. </strong>
                  The decision should have been taken by{" "}
                  {selectedEntry.delegatingAuthorityIds.map((id) => authorityMap.get(id)?.name).filter(Boolean).join(" and ") ||
                    "the authority named"}
                  . Record who actually took it.
                </div>
              )}
              {selectedEntry?.status === "not_delegable" && (
                <div className="note d" style={{ marginBottom: 14 }}>
                  <strong>This is a personal statutory duty. </strong>
                  It cannot be exercised by anyone else.
                </div>
              )}
              {selectedEntry?.pajaLinked && (
                <div className="note i" style={{ marginBottom: 14 }}>
                  Administrative justice applies: notice, an opportunity to make representations, and written reasons. Record that they were given.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="dsec">
                  <div className="dsec-h">Date of the decision</div>
                  <input type="date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} />
                </div>
                <div className="dsec">
                  <div className="dsec-h">Taken by</div>
                  <select value={draft.takenById} onChange={(ev) => setDraft({ ...draft, takenById: ev.target.value })}>
                    <option value="">Choose…</option>
                    {authorities.map((a) => (
                      <option key={a.v} value={a.v}>
                        {a.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dsec" style={{ marginTop: 14 }}>
                <div className="dsec-h">What was decided</div>
                <input type="text" placeholder="One line for the report" value={draft.summary} onChange={(ev) => setDraft({ ...draft, summary: ev.target.value })} />
              </div>

              <div className="dsec" style={{ marginTop: 14 }}>
                <div className="dsec-h">Reasons, conditions, evidence</div>
                <textarea rows={3} value={draft.note} onChange={(ev) => setDraft({ ...draft, note: ev.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div className="dsec">
                  <div className="dsec-h">Amount, if any</div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Rand"
                    value={draft.amount}
                    onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })}
                  />
                </div>
                <div className="dsec">
                  <div className="dsec-h">Reporting category</div>
                  <select value={draft.category} onChange={(ev) => setDraft({ ...draft, category: ev.target.value })}>
                    <option value="">Not reportable</option>
                    {org.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dsec" style={{ marginTop: 14 }}>
                <div className="dsec-h">Reported to {org.governingBody || "the governing body"} on</div>
                <input type="date" value={draft.reportedOn} onChange={(ev) => setDraft({ ...draft, reportedOn: ev.target.value })} />
              </div>

              {err && (
                <div className="note d" style={{ marginTop: 14 }}>
                  {err}
                </div>
              )}
            </div>
            <div className="drawer-f">
              <span style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={() => setDraft(null)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="btn pri" onClick={save} disabled={pending}>
                Save decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
