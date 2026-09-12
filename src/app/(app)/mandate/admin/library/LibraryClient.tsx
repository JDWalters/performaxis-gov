"use client";

/**
 * By-law library browser - ported from library.js's pack list + adopt()/
 * remove(). "Adopted" is tracked purely by mandate_entries.pack_id (set when
 * a pack's rows are copied into the register), matching the reference's own
 * packId-linkage approach - editing a pack's library rows later doesn't
 * retroactively change already-adopted delegations; you remove and re-add.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MandateBylawPack } from "@/lib/data/mandate-shared";
import { adoptBylawPack, removeBylawPack } from "../actions";

export function LibraryClient({ orgId, packs, adopted }: { orgId: string; packs: MandateBylawPack[]; adopted: Record<string, number> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const query = q.trim().toLowerCase();
  const rows = packs.filter((p) => !query || p.name.toLowerCase().includes(query) || p.bylawTitle.toLowerCase().includes(query));

  function adopt(p: MandateBylawPack) {
    setErr("");
    setBusyId(p.id);
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("packId", p.id);
    startTransition(async () => {
      try {
        const res = await adoptBylawPack(fd);
        router.refresh();
        alert(`Added ${res.added} delegation${res.added === 1 ? "" : "s"} from ${p.name}.`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function remove(p: MandateBylawPack) {
    if (!confirm(`Remove every delegation adopted from ${p.name}? This deletes those rows from the register.`)) return;
    setErr("");
    setBusyId(p.id);
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("packId", p.id);
    startTransition(async () => {
      try {
        await removeBylawPack(fd);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="phead">
        <div>
          <div className="eyebrow gold">Set up</div>
          <h1 className="serif">By-law library</h1>
        </div>
      </div>
      <p className="pnote">
        Pre-built delegation packs for common by-laws. Adding a pack copies its rows into this register as new
        delegations, resolving post names against this org&apos;s posts and bodies. Editing a pack here does not change
        rows already added - remove the pack and add it again to apply corrections.
      </p>

      <div className="filters">
        <div className="f grow">
          <span>Find a pack</span>
          <input type="search" value={q} placeholder="Pack name…" onChange={(ev) => setQ(ev.target.value)} />
        </div>
      </div>

      {err && <div className="note d" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="tw">
        <table className="reg">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Instrument</th>
              <th>Status</th>
              <th className="go" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const count = adopted[p.id] ?? 0;
              const busy = pending && busyId === p.id;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="small muted">{p.bylawTitle}</td>
                  <td>{count > 0 ? <span className="pill accepted">Adopted ({count})</span> : <span className="pill draft">Not adopted</span>}</td>
                  <td className="go">
                    {count > 0 ? (
                      <button type="button" className="btn sm dgr" disabled={busy} onClick={() => remove(p)}>
                        Remove
                      </button>
                    ) : (
                      <button type="button" className="btn sm pri" disabled={busy} onClick={() => adopt(p)}>
                        Add to register
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
