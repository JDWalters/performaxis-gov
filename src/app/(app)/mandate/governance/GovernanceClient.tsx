"use client";

/**
 * Mandate governance workspace - ported from assets/governance.js. Four
 * tabs (Dashboard, My changes, Approval queue, History) plus the propose/
 * review modals that drive the draft -> submit -> approve/return workflow.
 * The reference's fifth tab, "User access", is deliberately not rebuilt
 * here - per JD's decision to fold Mandate access into performaxis-gov's
 * own RBAC, granting access happens on the existing Manage Users screen.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateAuthority, MandateOrg, AuthorityMap } from "@/lib/data/mandate-shared";
import { authorityMap, alignment, legislationOf } from "@/lib/data/mandate-shared";
import type { EntrySnapshot, MandateChangeRequest, MandateVersion, MandateWorkflowEvent } from "@/lib/data/mandate-governance-shared";
import { CHAIN_FIELDS, fieldLabel, snapshot, statusLabel, statusTone, showField } from "@/lib/data/mandate-governance-shared";
import { proposeChange, submitDraftChange, decideChange } from "./actions";

type Tab = "dashboard" | "mine" | "queue" | "history";

export function GovernanceClient({
  orgs,
  org,
  entries,
  authorities: authorityList,
  changes,
  versions,
  events,
  canPropose,
  canDecide,
  canManage,
  initialEntryId,
  currentUserId,
}: {
  orgs: { id: string; name: string }[];
  org: MandateOrg;
  entries: MandateEntry[];
  authorities: MandateAuthority[];
  changes: MandateChangeRequest[];
  versions: MandateVersion[];
  events: MandateWorkflowEvent[];
  canPropose: boolean;
  canDecide: boolean;
  canManage: boolean;
  initialEntryId: string | null;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const authorities = useMemo(() => authorityMap(authorityList), [authorityList]);
  const openInitialPropose = !!(initialEntryId && canPropose);
  const [tab, setTab] = useState<Tab>(openInitialPropose ? "mine" : "dashboard");
  const [queueFilter, setQueueFilter] = useState<"submitted" | "all">("submitted");
  const [proposeEntryId, setProposeEntryId] = useState<string | null | "pick">(openInitialPropose ? initialEntryId : null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const pending = useMemo(() => changes.filter((c) => c.status === "submitted"), [changes]);
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const reviewingChange = reviewingId ? (changes.find((c) => c.id === reviewingId) ?? null) : null;

  return (
    <div className="page wide" style={{ padding: "24px 26px 60px", maxWidth: 1300, margin: "0 auto" }}>
      {orgs.length > 1 && (
        <div className="btnrow" style={{ marginBottom: 14 }}>
          <span className="eyebrow" style={{ marginBottom: 0 }}>
            Client
          </span>
          <select
            value={org.id}
            onChange={(ev) => router.push(`/mandate/governance?org=${ev.target.value}`)}
            style={{ width: "auto", minWidth: 220 }}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="phead">
        <div>
          <div className="eyebrow gold">{org.name}</div>
          <h1 className="serif">Delegations Governance</h1>
        </div>
      </div>
      <p className="pnote">Controlled amendments, approvals and audit history.</p>

      <nav className="filters" role="tablist" style={{ gap: 4 }}>
        {(
          [
            ["dashboard", "Dashboard"],
            ["mine", "My changes"],
            ["queue", `Approval queue (${pending.length})`],
            ["history", "History"],
          ] as [Tab, string][]
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            className={`btn${tab === v ? " pri" : ""}`}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <Dashboard
          entries={entries}
          changes={changes}
          events={events}
          pendingCount={pending.length}
          currentUserId={currentUserId}
          canManage={canManage}
          onOpenRegister={() => router.push(`/mandate?org=${org.id}`)}
        />
      )}

      {tab === "mine" && (
        <MyChanges
          changes={changes.filter((c) => c.createdBy === currentUserId)}
          canPropose={canPropose}
          onPropose={() => setProposeEntryId("pick")}
          onOpen={setReviewingId}
        />
      )}

      {tab === "queue" && (
        <Queue
          changes={changes}
          queueFilter={queueFilter}
          setQueueFilter={setQueueFilter}
          entryById={entryById}
          onOpen={setReviewingId}
        />
      )}

      {tab === "history" && <History versions={versions} events={events} />}

      {proposeEntryId && (
        <AmendModal
          orgId={org.id}
          entryId={proposeEntryId === "pick" ? null : proposeEntryId}
          entries={entries}
          authorities={authorityList}
          org={org}
          onClose={() => setProposeEntryId(null)}
        />
      )}

      {reviewingChange && (
        <ReviewModal
          change={reviewingChange}
          entry={reviewingChange.entryId ? (entryById.get(reviewingChange.entryId) ?? null) : null}
          authorities={authorities}
          canDecide={canDecide}
          currentUserId={currentUserId}
          onClose={() => setReviewingId(null)}
        />
      )}
    </div>
  );
}

function Dashboard({
  entries,
  changes,
  events,
  pendingCount,
  currentUserId,
  canManage,
  onOpenRegister,
}: {
  entries: MandateEntry[];
  changes: MandateChangeRequest[];
  events: MandateWorkflowEvent[];
  pendingCount: number;
  currentUserId: string | null;
  canManage: boolean;
  onOpenRegister: () => void;
}) {
  const actionCount = entries.filter((e) => alignment(e) === "action").length;
  const myDrafts = changes.filter((c) => c.status === "draft" && c.createdBy === currentUserId).length;
  const recent = events.slice(0, 8);

  return (
    <>
      <div className="cards c4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="k">Operative rows</div>
          <div className="v">{entries.length.toLocaleString("en-ZA")}</div>
          <div className="s">In the current register</div>
        </div>
        <div className="stat">
          <div className="k">Awaiting decision</div>
          <div className="v">{pendingCount.toLocaleString("en-ZA")}</div>
          <div className="s">Submitted for approval</div>
        </div>
        <div className="stat">
          <div className="k">My drafts</div>
          <div className="v">{myDrafts.toLocaleString("en-ZA")}</div>
          <div className="s">Not yet submitted</div>
        </div>
        <div className="stat warn">
          <div className="k">Designation gaps</div>
          <div className="v">{actionCount.toLocaleString("en-ZA")}</div>
          <div className="s">Rows the organogram cannot answer</div>
        </div>
      </div>

      {canManage && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-b">
            <h3 className="serif" style={{ marginTop: 0 }}>
              Administrator — working on the register directly
            </h3>
            <p className="muted">
              Setting a register up is not the same as amending one that is already in force. Posts/bodies setup, the
              by-law library and the delegation importer are being built next.
            </p>
            <div className="btnrow">
              <button type="button" className="btn" onClick={onOpenRegister}>
                Open the register
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>Recent activity</h3>
        </div>
        <div className="card-b">
          {recent.length === 0 ? (
            <p className="muted">No workflow events recorded yet. Activity appears here as changes are proposed and decided.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.map((e) => (
                <EventItem key={e.id} e={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function EventItem({ e }: { e: MandateWorkflowEvent }) {
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        className={`pill ${e.action === "Approved" ? "accepted" : e.action === "Returned" ? "withdrawn" : "draft"}`}
        style={{ minWidth: 8, minHeight: 8, padding: 0, borderRadius: "50%" }}
      />
      <div>
        <div>
          {e.action}
          {e.detail ? ` — ${e.detail}` : ""}
        </div>
        <div className="small muted">
          {new Date(e.at).toLocaleString("en-ZA")} · {e.whoName}
        </div>
      </div>
    </li>
  );
}

function ChangeTable({ rows, onOpen }: { rows: MandateChangeRequest[]; onOpen: (id: string) => void }) {
  return (
    <div className="tw">
      <table className="reg">
        <thead>
          <tr>
            <th>Reference</th>
            <th>What changes</th>
            <th>Raised</th>
            <th>Status</th>
            <th className="go" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="clickable" onClick={() => onOpen(c.id)}>
              <td>
                <span className="mono small">{c.ref}</span>
              </td>
              <td>
                <span className="cond">{c.fields.map(fieldLabel).join(", ") || "—"}</span>
              </td>
              <td>
                <div className="small">{c.createdByName}</div>
                <div className="small muted">{c.createdAt.slice(0, 10)}</div>
              </td>
              <td>
                <span className={`align ${statusTone(c.status)}`}>{statusLabel(c.status)}</span>
              </td>
              <td className="go">
                <button
                  type="button"
                  className="arrow"
                  aria-label="Open"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onOpen(c.id);
                  }}
                >
                  →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyChanges({
  changes,
  canPropose,
  onPropose,
  onOpen,
}: {
  changes: MandateChangeRequest[];
  canPropose: boolean;
  onPropose: () => void;
  onOpen: (id: string) => void;
}) {
  const rows = changes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="regpanel">
      <div className="regpanel-h">
        <div>
          <div className="eyebrow gold">Drafting</div>
          <h1 className="serif">My change requests</h1>
        </div>
        {canPropose && (
          <div className="btnrow">
            <button type="button" className="btn pri" onClick={onPropose}>
              + Propose amendment
            </button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet.</h3>
          <p className="muted">No change requests match this view.</p>
        </div>
      ) : (
        <ChangeTable rows={rows} onOpen={onOpen} />
      )}
    </section>
  );
}

function Queue({
  changes,
  queueFilter,
  setQueueFilter,
  onOpen,
}: {
  changes: MandateChangeRequest[];
  queueFilter: "submitted" | "all";
  setQueueFilter: (v: "submitted" | "all") => void;
  entryById: Map<string, MandateEntry>;
  onOpen: (id: string) => void;
}) {
  const rows = changes
    .filter((c) => (queueFilter === "submitted" ? c.status === "submitted" : c.status !== "draft"))
    .sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  return (
    <section className="regpanel">
      <div className="regpanel-h">
        <div>
          <div className="eyebrow gold">Decision queue</div>
          <h1 className="serif">Review and approval</h1>
        </div>
        <select value={queueFilter} onChange={(ev) => setQueueFilter(ev.target.value as "submitted" | "all")} style={{ width: "auto" }}>
          <option value="submitted">Awaiting decision</option>
          <option value="all">Everything submitted or decided</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet.</h3>
          <p className="muted">No change requests match this view.</p>
        </div>
      ) : (
        <ChangeTable rows={rows} onOpen={onOpen} />
      )}
    </section>
  );
}

function History({ versions, events }: { versions: MandateVersion[]; events: MandateWorkflowEvent[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className="card">
        <div className="card-h">
          <h3>Approved versions</h3>
        </div>
        <div className="card-b">
          {versions.length === 0 ? (
            <p className="muted">No amendments have been approved yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {versions.map((v) => (
                <li key={v.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="mono ref">v{v.no}</span>
                  <div>
                    <div>{v.label}</div>
                    <div className="small muted">
                      {v.approvedAt.slice(0, 10)} · {v.approvedByName}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Audit events</h3>
        </div>
        <div className="card-b">
          {events.length === 0 ? (
            <p className="muted">No workflow events recorded yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {events.map((e) => (
                <EventItem key={e.id} e={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PostChips({
  label,
  ids,
  note,
  authorities,
  onToggle,
  onNote,
}: {
  label: string;
  ids: string[];
  note: string;
  authorities: MandateAuthority[];
  onToggle: (id: string) => void;
  onNote: (v: string) => void;
}) {
  return (
    <div className="f grow" style={{ marginBottom: 10 }}>
      <span>{label}</span>
      <div className="pickbox" style={{ maxHeight: 120 }}>
        {authorities.map((a) => {
          const on = ids.includes(a.id);
          return (
            <div key={a.id} className="pickrow" onClick={() => onToggle(a.id)}>
              <input type="checkbox" readOnly checked={on} />
              <span>{a.short ? `${a.short} — ${a.name}` : a.name}</span>
              {a.department && <span className="dept">{a.department}</span>}
            </div>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Wording used in the source, if no post applies"
        value={note}
        onChange={(ev) => onNote(ev.target.value)}
        style={{ marginTop: 6 }}
      />
    </div>
  );
}

function AmendModal({
  orgId,
  entryId,
  entries,
  authorities,
  org,
  onClose,
}: {
  orgId: string;
  entryId: string | null;
  entries: MandateEntry[];
  authorities: MandateAuthority[];
  org: MandateOrg;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(entryId || "");
  const entry = selectedId ? (entries.find((e) => e.id === selectedId) ?? null) : null;
  const [after, setAfter] = useState<EntrySnapshot | null>(entry ? snapshot(entry) : null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  function pickEntry(id: string) {
    setSelectedId(id);
    const e = entries.find((x) => x.id === id) ?? null;
    setAfter(e ? snapshot(e) : null);
  }

  function submit(doSubmit: boolean) {
    if (!after || !selectedId) return;
    setErr("");
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("entryId", selectedId);
    fd.set("reason", reason);
    fd.set("submit", doSubmit ? "1" : "0");
    fd.set("after", JSON.stringify(after));
    startTransition(async () => {
      try {
        await proposeChange(fd);
        onClose();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="drawer detail" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>
            <div className="eyebrow gold">Propose an amendment</div>
            <h2 className="serif">{entry ? entry.description : "Choose a delegation"}</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-b">
          {!entry ? (
            <>
              <p className="muted">Choose the delegation to amend.</p>
              <select value={selectedId} onChange={(ev) => pickEntry(ev.target.value)}>
                <option value="">Select a delegation…</option>
                {entries.slice(0, 400).map((x) => (
                  <option key={x.id} value={x.id}>
                    {`${legislationOf(x, org)} ${x.provision || ""} — ${x.description}`.slice(0, 120)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            after && (
              <>
                {CHAIN_FIELDS.map((f) => (
                  <PostChips
                    key={f.k}
                    label={f.l}
                    ids={after[f.k] as string[]}
                    note={after[f.n] as string}
                    authorities={authorities}
                    onToggle={(id) =>
                      setAfter((cur) => {
                        if (!cur) return cur;
                        const arr = (cur[f.k] as string[]).slice();
                        const i = arr.indexOf(id);
                        if (i >= 0) arr.splice(i, 1);
                        else arr.push(id);
                        return { ...cur, [f.k]: arr };
                      })
                    }
                    onNote={(v) => setAfter((cur) => (cur ? { ...cur, [f.n]: v } : cur))}
                  />
                ))}
                <div className="dsec">
                  <div className="dsec-h">Conditions and limitations</div>
                  <textarea
                    rows={3}
                    value={after.conditions}
                    onChange={(ev) => setAfter((cur) => (cur ? { ...cur, conditions: ev.target.value } : cur))}
                  />
                </div>
                <div className="dsec">
                  <div className="dsec-h">Legal review status</div>
                  <input
                    type="text"
                    value={after.reviewStatus}
                    onChange={(ev) => setAfter((cur) => (cur ? { ...cur, reviewStatus: ev.target.value } : cur))}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                  <input
                    type="checkbox"
                    checked={after.status === "reserved"}
                    onChange={(ev) => setAfter((cur) => (cur ? { ...cur, status: ev.target.checked ? "reserved" : "delegated" } : cur))}
                  />
                  <span>Reserved to the governing body — no post mapping required</span>
                </label>
                <div className="dsec">
                  <div className="dsec-h">Reason for the change (required)</div>
                  <textarea
                    rows={3}
                    placeholder="Council resolution, organogram change, legal advice…"
                    value={reason}
                    onChange={(ev) => setReason(ev.target.value)}
                  />
                </div>
                {err && <div className="note d">{err}</div>}
              </>
            )
          )}
        </div>
        <div className="drawer-f">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!entry || pending} onClick={() => submit(false)}>
            Save draft
          </button>
          <button type="button" className="btn pri" disabled={!entry || pending} onClick={() => submit(true)}>
            Submit for approval
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({
  change,
  entry,
  authorities,
  canDecide,
  currentUserId,
  onClose,
}: {
  change: MandateChangeRequest;
  entry: MandateEntry | null;
  authorities: AuthorityMap;
  canDecide: boolean;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  function act(kind: "submit" | "approve" | "reject") {
    setErr("");
    const fd = new FormData();
    startTransition(async () => {
      try {
        if (kind === "submit") {
          fd.set("changeId", change.id);
          await submitDraftChange(fd);
        } else {
          fd.set("changeId", change.id);
          fd.set("approve", kind === "approve" ? "1" : "0");
          await decideChange(fd);
        }
        onClose();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="drawer detail" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>
            <div className="eyebrow gold">
              Change request {change.ref} · {statusLabel(change.status)}
            </div>
            <h2 className="serif">{entry ? entry.description : "Delegation removed"}</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-b">
          <div className="dsec">
            <div className="dsec-h">Reason given</div>
            <p className={change.reason ? "" : "muted"}>{change.reason || "No reason recorded."}</p>
          </div>
          <div className="tw">
            <table className="reg">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Currently</th>
                  <th>Proposed</th>
                </tr>
              </thead>
              <tbody>
                {change.fields.map((k) => (
                  <tr key={k}>
                    <td>{fieldLabel(k)}</td>
                    <td className="cond">{change.before ? showField(k, change.before, authorities) : "—"}</td>
                    <td className="cond">{change.after ? showField(k, change.after, authorities) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err && <div className="note d" style={{ marginTop: 12 }}>{err}</div>}
        </div>
        <div className="drawer-f">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Close
          </button>
          {change.status === "draft" && change.createdBy === currentUserId && (
            <button type="button" className="btn pri" disabled={pending} onClick={() => act("submit")}>
              Submit for approval
            </button>
          )}
          {change.status === "submitted" && canDecide && (
            <>
              <button type="button" className="btn dgr" disabled={pending} onClick={() => act("reject")}>
                Return to author
              </button>
              <button type="button" className="btn pri" disabled={pending} onClick={() => act("approve")}>
                Approve and apply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
