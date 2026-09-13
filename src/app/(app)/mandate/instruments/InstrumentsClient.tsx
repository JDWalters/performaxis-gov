"use client";

/**
 * Instruments (Annexure C) - read-only table (built in an earlier session)
 * plus the "Issue instrument" creation drawer, ported field-for-field from
 * assets/edit.js's drawInstrument(). Same drawer/dsec shell as
 * admin/structure's StructureClient, since that's this codebase's
 * established pattern for a Mandate create/edit form.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateInstrument } from "@/lib/data/mandate-shared";
import { liveInstruments, type AuthorityMap } from "@/lib/data/mandate-shared";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import { saveInstrument } from "./actions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Draft = {
  id: string;
  entryId: string;
  fromPostId: string;
  toPostId: string;
  conditions: string;
  issuedOn: string;
  acceptedOn: string;
  withdrawnOn: string;
  status: string;
};

function blank(): Draft {
  return { id: "", entryId: "", fromPostId: "", toPostId: "", conditions: "", issuedOn: today(), acceptedOn: "", withdrawnOn: "", status: "draft" };
}

export function InstrumentsClient({
  orgs,
  currentOrgId,
  entries,
  authorities,
  authorityMap,
  instruments,
  canEdit,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  entries: MandateEntry[];
  authorities: { v: string; l: string }[];
  authorityMap: AuthorityMap;
  instruments: MandateInstrument[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const live = useMemo(() => new Set(liveInstruments(instruments).map((i) => i.id)), [instruments]);

  // Only delegated entries may be issued an instrument, sorted by ref - ported from drawInstrument()'s entry picker.
  const delegableEntries = useMemo(
    () =>
      entries
        .filter((e) => e.status === "delegated")
        .slice()
        .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })),
    [entries]
  );

  const selectedEntry = draft?.entryId ? entryById.get(draft.entryId) ?? null : null;
  const toAuthority = draft?.toPostId ? authorityMap.get(draft.toPostId) ?? null : null;
  const allowedHolders = selectedEntry ? [...selectedEntry.delegateIds, ...selectedEntry.subDelegateIds] : [];
  const outsideRegister =
    !!selectedEntry && !!draft?.toPostId && selectedEntry.status === "delegated" && !selectedEntry.subDelegateNone && allowedHolders.length > 0 && !allowedHolders.includes(draft.toPostId);

  function openNew() {
    setErr("");
    setDraft(blank());
  }

  function save() {
    if (!draft) return;
    setErr("");
    const fd = new FormData();
    fd.set("orgId", currentOrgId);
    fd.set("id", draft.id);
    fd.set("entryId", draft.entryId);
    fd.set("fromPostId", draft.fromPostId);
    fd.set("toPostId", draft.toPostId);
    fd.set("conditions", draft.conditions);
    fd.set("issuedOn", draft.issuedOn);
    fd.set("acceptedOn", draft.acceptedOn);
    fd.set("withdrawnOn", draft.withdrawnOn);
    fd.set("status", draft.status);
    startTransition(async () => {
      try {
        await saveInstrument(fd);
        setDraft(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1200, margin: "0 auto" }}>
      <MandateOrgSwitcher orgs={orgs} currentOrgId={currentOrgId} basePath="/mandate/instruments" />

      <div className="phead">
        <div>
          <div className="eyebrow gold">Operate</div>
          <h1 className="serif">Instruments</h1>
        </div>
        {canEdit && (
          <div className="btnrow">
            <button type="button" className="btn pri" onClick={openNew}>
              Issue instrument
            </button>
          </div>
        )}
      </div>
      <p className="pnote">The individual instruments that give effect to a delegation - who it was issued to, when, and whether it is currently in force.</p>

      {instruments.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet.</h3>
          <p className="muted">No instruments have been recorded for this register.</p>
          {canEdit && (
            <button type="button" className="btn pri" onClick={openNew} style={{ marginTop: 12 }}>
              Issue instrument
            </button>
          )}
        </div>
      ) : (
        <div className="tw">
          <table className="reg">
            <thead>
              <tr>
                <th>Ref</th>
                <th>From</th>
                <th>To</th>
                <th>Issued</th>
                <th>Accepted</th>
                <th>Withdrawn</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => {
                const e = i.entryId ? entryById.get(i.entryId) : null;
                const fromA = i.fromPostId ? authorityMap.get(i.fromPostId) : null;
                const toA = i.toPostId ? authorityMap.get(i.toPostId) : null;
                return (
                  <tr key={i.id}>
                    <td className="ref">{e?.ref || "—"}</td>
                    <td>{fromA ? fromA.short || fromA.name : "—"}</td>
                    <td>{toA ? toA.short || toA.name : "—"}</td>
                    <td className="nowrap">{i.issuedOn || "—"}</td>
                    <td className="nowrap">{i.acceptedOn || "—"}</td>
                    <td className="nowrap">{i.withdrawnOn || "—"}</td>
                    <td>
                      <span className={`pill ${live.has(i.id) ? "accepted" : i.status}`}>{live.has(i.id) ? "In force" : i.status}</span>
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
                <div className="eyebrow gold">Annexure C</div>
                <h2 className="serif">{draft.id ? "Instrument" : "Issue instrument"}</h2>
              </div>
              <button type="button" className="x" aria-label="Close" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="drawer-b">
              <div className="dsec">
                <div className="dsec-h">Power being delegated</div>
                <select value={draft.entryId} onChange={(ev) => setDraft({ ...draft, entryId: ev.target.value })}>
                  <option value="">Choose an entry…</option>
                  {delegableEntries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.ref} — {e.description.slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEntry && (
                <div className="note i" style={{ marginBottom: 14 }}>
                  <div>
                    <strong>{selectedEntry.ref}. </strong>
                    {selectedEntry.description}
                  </div>
                  {selectedEntry.conditions && (
                    <div style={{ marginTop: 6 }}>
                      <em>{selectedEntry.conditions}</em>
                    </div>
                  )}
                </div>
              )}
              {selectedEntry?.subDelegateNone && (
                <div className="note d" style={{ marginBottom: 14 }}>
                  <strong>This power may not be sub-delegated. </strong>
                  An instrument may still record the original delegation, but not a further one.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="dsec">
                  <div className="dsec-h">From</div>
                  <select value={draft.fromPostId} onChange={(ev) => setDraft({ ...draft, fromPostId: ev.target.value })}>
                    <option value="">Choose…</option>
                    {authorities.map((a) => (
                      <option key={a.v} value={a.v}>
                        {a.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dsec">
                  <div className="dsec-h">To</div>
                  <select value={draft.toPostId} onChange={(ev) => setDraft({ ...draft, toPostId: ev.target.value })}>
                    <option value="">Choose…</option>
                    {authorities.map((a) => (
                      <option key={a.v} value={a.v}>
                        {a.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {toAuthority?.vacant && (
                <div className="note d" style={{ marginTop: 14, marginBottom: 14 }}>
                  <strong>{toAuthority.name} is vacant. </strong>
                  An instrument cannot be accepted against a vacant post. Issue it once the post is filled, or delegate to the immediate superior.
                </div>
              )}
              {outsideRegister && (
                <div className="note b" style={{ marginTop: 14, marginBottom: 14 }}>
                  <strong>Outside the register. </strong>
                  The entry names {allowedHolders.map((id) => authorityMap.get(id)?.name || id).join(" and ")}. Issuing to someone else means
                  amending the entry as well.
                </div>
              )}

              <div className="dsec" style={{ marginTop: 14 }}>
                <div className="dsec-h">Conditions and limits on this instrument</div>
                <textarea rows={3} value={draft.conditions} onChange={(ev) => setDraft({ ...draft, conditions: ev.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                <div className="dsec">
                  <div className="dsec-h">Issued on</div>
                  <input type="date" value={draft.issuedOn} onChange={(ev) => setDraft({ ...draft, issuedOn: ev.target.value })} />
                </div>
                <div className="dsec">
                  <div className="dsec-h">Accepted on</div>
                  <input
                    type="date"
                    value={draft.acceptedOn}
                    onChange={(ev) => setDraft({ ...draft, acceptedOn: ev.target.value, status: ev.target.value ? "accepted" : draft.status })}
                  />
                </div>
                <div className="dsec">
                  <div className="dsec-h">Withdrawn on</div>
                  <input
                    type="date"
                    value={draft.withdrawnOn}
                    onChange={(ev) => setDraft({ ...draft, withdrawnOn: ev.target.value, status: ev.target.value ? "withdrawn" : draft.status })}
                  />
                </div>
              </div>

              <div className="dsec" style={{ marginTop: 14 }}>
                <div className="dsec-h">Status</div>
                <select value={draft.status} onChange={(ev) => setDraft({ ...draft, status: ev.target.value })}>
                  <option value="draft">Draft — not yet issued</option>
                  <option value="issued">Issued — awaiting acceptance</option>
                  <option value="accepted">Accepted — in force</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              {draft.status === "accepted" && !draft.acceptedOn && (
                <div className="note b" style={{ marginTop: 14 }}>
                  Set the date of acceptance — the instrument takes effect from that date.
                </div>
              )}
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
                Save instrument
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
