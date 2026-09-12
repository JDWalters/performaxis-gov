"use client";

/**
 * Direct delegation entry editor - ported from admin.js's editEntry()/
 * entryModal(). Administrator-only, no approval step (unlike amending an
 * existing entry's chain via the governance workflow - task #205); used for
 * adding a brand-new row to the register during setup. ref/schedule are
 * auto-generated server-side on create, matching the reference.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateAuthority } from "@/lib/data/mandate-shared";
import { saveEntryDirect } from "./admin/actions";

const KINDS = ["Act", "Regulation", "By-law", "Policy", "Collective agreement", "Council delegation", "Constitution", "Council resolution", "Instrument"];

const CHAIN: { key: string; noteKey: string; label: string }[] = [
  { key: "delegatingAuthorityIds", noteKey: "delegatingAuthorityNote", label: "Delegating authority" },
  { key: "delegatedBodyIds", noteKey: "delegatedBodyNote", label: "Delegated body" },
  { key: "delegateIds", noteKey: "delegateNote", label: "Delegated to" },
  { key: "subDelegateIds", noteKey: "subDelegateNote", label: "Sub-delegated to" },
  { key: "furtherSubDelegateIds", noteKey: "furtherSubDelegateNote", label: "Further sub-delegated to" },
];

function ChainPicker({
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
    <div className="dsec">
      <div className="dsec-h">{label}</div>
      <div className="pickbox" style={{ maxHeight: 110 }}>
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
      <input type="text" placeholder="Wording used in the source, if no post applies" value={note} onChange={(ev) => onNote(ev.target.value)} style={{ marginTop: 6 }} />
    </div>
  );
}

export function MandateEntryEditor({ orgId, authorities, onClose }: { orgId: string; authorities: MandateAuthority[]; onClose: () => void }) {
  const router = useRouter();
  const [legislation, setLegislation] = useState("");
  const [instrumentType, setInstrumentType] = useState("");
  const [provision, setProvision] = useState("");
  const [description, setDescription] = useState("");
  const [chain, setChain] = useState<Record<string, string[]>>({
    delegatingAuthorityIds: [],
    delegatedBodyIds: [],
    delegateIds: [],
    subDelegateIds: [],
    furtherSubDelegateIds: [],
  });
  const [notes, setNotes] = useState<Record<string, string>>({
    delegatingAuthorityNote: "",
    delegatedBodyNote: "",
    delegateNote: "",
    subDelegateNote: "",
    furtherSubDelegateNote: "",
  });
  const [conditions, setConditions] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [establishmentNote, setEstablishmentNote] = useState("");
  const [reserved, setReserved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  function toggle(key: string, id: string) {
    setChain((cur) => {
      const arr = cur[key].slice();
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(id);
      return { ...cur, [key]: arr };
    });
  }

  function save() {
    setErr("");
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("legislation", legislation);
    fd.set("instrumentType", instrumentType);
    fd.set("provision", provision);
    fd.set("description", description);
    fd.set("conditions", conditions);
    fd.set("reviewStatus", reviewStatus);
    fd.set("reviewNote", reviewNote);
    fd.set("establishmentNote", establishmentNote);
    fd.set("reserved", reserved ? "1" : "0");
    for (const c of CHAIN) {
      for (const id of chain[c.key]) fd.append(c.key, id);
      fd.set(c.noteKey, notes[c.noteKey]);
    }
    startTransition(async () => {
      try {
        await saveEntryDirect(fd);
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
            <div className="eyebrow gold">Administrator · direct edit</div>
            <h2 className="serif">Add a delegation</h2>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-b">
          <div className="dsec">
            <div className="dsec-h">Legislation / regulation / by-law / policy / agreement</div>
            <input type="text" value={legislation} onChange={(ev) => setLegislation(ev.target.value)} />
          </div>
          <div className="dsec">
            <div className="dsec-h">Kind of instrument</div>
            <select value={instrumentType} onChange={(ev) => setInstrumentType(ev.target.value)}>
              <option value="">—</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="dsec">
            <div className="dsec-h">Section / provision</div>
            <input type="text" value={provision} onChange={(ev) => setProvision(ev.target.value)} />
          </div>
          <div className="dsec">
            <div className="dsec-h">Power conferred</div>
            <textarea rows={2} value={description} onChange={(ev) => setDescription(ev.target.value)} />
          </div>

          {CHAIN.map((c) => (
            <ChainPicker
              key={c.key}
              label={c.label}
              ids={chain[c.key]}
              note={notes[c.noteKey]}
              authorities={authorities}
              onToggle={(id) => toggle(c.key, id)}
              onNote={(v) => setNotes((cur) => ({ ...cur, [c.noteKey]: v }))}
            />
          ))}

          <div className="dsec">
            <div className="dsec-h">Conditions and limitations</div>
            <textarea rows={2} value={conditions} onChange={(ev) => setConditions(ev.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
            <input type="checkbox" checked={reserved} onChange={(ev) => setReserved(ev.target.checked)} />
            <span>Reserved to the governing body — no post mapping required</span>
          </label>
          <div className="dsec">
            <div className="dsec-h">Legal review status</div>
            <input type="text" value={reviewStatus} onChange={(ev) => setReviewStatus(ev.target.value)} />
          </div>
          <div className="dsec">
            <div className="dsec-h">Legal review note</div>
            <textarea rows={2} value={reviewNote} onChange={(ev) => setReviewNote(ev.target.value)} />
          </div>
          <div className="dsec">
            <div className="dsec-h">Establishment note</div>
            <input type="text" value={establishmentNote} onChange={(ev) => setEstablishmentNote(ev.target.value)} />
          </div>
          {err && <div className="note d">{err}</div>}
        </div>
        <div className="drawer-f">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn pri" disabled={pending || !legislation || !description} onClick={save}>
            Add to register
          </button>
        </div>
      </div>
    </div>
  );
}
