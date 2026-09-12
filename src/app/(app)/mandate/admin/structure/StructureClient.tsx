"use client";

/**
 * Posts and bodies CRUD - ported from admin.js's editAuth()/authModal()/
 * deleteAuth(). Department is a free-text field here rather than a select
 * bound to an org "departments" list (that list isn't part of MandateOrg -
 * performaxis-gov doesn't carry a parallel department-name list for Mandate,
 * only the org hierarchy's own department orgs) - a deliberate, small
 * simplification, not a scope change to the CRUD itself.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateAuthority } from "@/lib/data/mandate-shared";
import { saveAuthority, deleteAuthority } from "../actions";

type Kind = "body" | "post" | "group";
const KIND_LABEL: Record<Kind, string> = { body: "Governance bodies", post: "Posts carrying delegated authority", group: "Groups" };

type Draft = {
  id: string;
  kind: Kind;
  name: string;
  short: string;
  department: string;
  incumbent: string;
  note: string;
  vacant: boolean;
};

function blank(kind: Kind): Draft {
  return { id: "", kind, name: "", short: "", department: "", incumbent: "", note: "", vacant: false };
}

export function StructureClient({ orgId, authorities }: { orgId: string; authorities: MandateAuthority[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const query = q.trim().toLowerCase();
  const grouped = useMemo(() => {
    const hit = (a: MandateAuthority) =>
      !query || [a.name, a.short, a.incumbent, a.department, a.note].filter(Boolean).join(" ").toLowerCase().includes(query);
    const out: Record<Kind, MandateAuthority[]> = { body: [], post: [], group: [] };
    for (const a of authorities) {
      if (a.kind === "body" || a.kind === "post" || a.kind === "group") {
        if (hit(a)) out[a.kind].push(a);
      }
    }
    return out;
  }, [authorities, query]);

  function openEdit(a: MandateAuthority) {
    setErr("");
    setDraft({
      id: a.id,
      kind: (a.kind as Kind) || "post",
      name: a.name,
      short: a.short || "",
      department: a.department || "",
      incumbent: a.incumbent || "",
      note: a.note || "",
      vacant: a.vacant,
    });
  }

  function save() {
    if (!draft) return;
    setErr("");
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("id", draft.id);
    fd.set("kind", draft.kind);
    fd.set("name", draft.name);
    fd.set("short", draft.short);
    fd.set("department", draft.department);
    fd.set("incumbent", draft.incumbent);
    fd.set("note", draft.note);
    fd.set("vacant", draft.vacant ? "1" : "0");
    startTransition(async () => {
      try {
        await saveAuthority(fd);
        setDraft(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove(a: MandateAuthority) {
    if (!confirm(`Delete ${a.name}? If it's used anywhere in the register, it will be removed from those delegations too.`)) return;
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("id", a.id);
    startTransition(async () => {
      try {
        await deleteAuthority(fd);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="phead">
        <div>
          <div className="eyebrow gold">Set up</div>
          <h1 className="serif">Posts and bodies</h1>
        </div>
        <div className="btnrow">
          <button type="button" className="btn" onClick={() => setDraft(blank("body"))}>
            Add body
          </button>
          <button type="button" className="btn pri" onClick={() => setDraft(blank("post"))}>
            Add post
          </button>
        </div>
      </div>
      <p className="pnote">
        The posts and bodies this register names as holding or delegating authority - not the whole staff establishment.
        Marking a post vacant flags every delegation that depends on it.
      </p>

      <div className="filters">
        <div className="f grow">
          <span>Find a post or body</span>
          <input type="search" value={q} placeholder="Name, post number, incumbent or department…" onChange={(ev) => setQ(ev.target.value)} />
        </div>
      </div>

      {(["body", "post", "group"] as Kind[]).map((kind) => {
        const list = grouped[kind];
        if (!list.length) return null;
        return (
          <div key={kind} style={{ marginBottom: 22 }}>
            <h3 className="serif" style={{ margin: "22px 0 10px", fontSize: 15 }}>
              {KIND_LABEL[kind]} ({list.length})
            </h3>
            <div className="tw">
              <table className="reg">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>{kind === "post" ? "Incumbent" : "Note"}</th>
                    {kind === "post" && <th>Department</th>}
                    <th>Status</th>
                    <th className="go" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => openEdit(a)}>
                      <td>
                        {a.short && <span className="mono small" style={{ marginRight: 6 }}>{a.short}</span>}
                        {a.name}
                      </td>
                      <td>{kind === "post" ? a.incumbent || "—" : a.note || "—"}</td>
                      {kind === "post" && <td>{a.department || "—"}</td>}
                      <td>{a.vacant ? <span className="pill not_delegable">Vacant</span> : <span className="pill accepted">Filled</span>}</td>
                      <td className="go">
                        <button
                          type="button"
                          className="btn sm dgr"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            remove(a);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {draft && (
        <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && setDraft(null)}>
          <div className="drawer detail" role="dialog" aria-modal="true">
            <div className="drawer-h">
              <div>
                <div className="eyebrow gold">{draft.id ? "Edit" : "Add"} {draft.kind}</div>
                <h2 className="serif">{draft.name || (draft.kind === "post" ? "New post" : "New body")}</h2>
              </div>
              <button type="button" className="x" aria-label="Close" onClick={() => setDraft(null)}>
                ×
              </button>
            </div>
            <div className="drawer-b">
              <div className="dsec">
                <div className="dsec-h">Name</div>
                <input type="text" value={draft.name} onChange={(ev) => setDraft({ ...draft, name: ev.target.value })} />
              </div>
              <div className="dsec">
                <div className="dsec-h">Short code / post number</div>
                <input type="text" value={draft.short} onChange={(ev) => setDraft({ ...draft, short: ev.target.value })} />
              </div>
              {draft.kind === "post" && (
                <>
                  <div className="dsec">
                    <div className="dsec-h">Incumbent</div>
                    <input type="text" value={draft.incumbent} onChange={(ev) => setDraft({ ...draft, incumbent: ev.target.value })} />
                  </div>
                  <div className="dsec">
                    <div className="dsec-h">Department</div>
                    <input type="text" value={draft.department} onChange={(ev) => setDraft({ ...draft, department: ev.target.value })} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                    <input type="checkbox" checked={draft.vacant} onChange={(ev) => setDraft({ ...draft, vacant: ev.target.checked })} />
                    <span>Vacant</span>
                  </label>
                </>
              )}
              <div className="dsec">
                <div className="dsec-h">Note</div>
                <textarea rows={2} value={draft.note} onChange={(ev) => setDraft({ ...draft, note: ev.target.value })} />
              </div>
              {err && <div className="note d">{err}</div>}
            </div>
            <div className="drawer-f">
              <button type="button" className="btn" onClick={() => setDraft(null)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="btn pri" onClick={save} disabled={pending}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
