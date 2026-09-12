"use client";

/**
 * "Who may do what" - ported from assets/views.js's authority() function.
 * Pick a post or body, see everything it holds directly, may receive by
 * sub-delegation, cannot delegate away, and (for bodies) delegates onward -
 * each as a Ref/Power/Conditions table whose rows open the same delegation
 * detail drawer as the register.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateAuthority, MandateOrg, MandateInstrument, AuthorityMap } from "@/lib/data/mandate-shared";
import {
  authorityMap,
  delegatesOf,
  authorityOptions,
  liveInstruments,
  flagsFor,
} from "@/lib/data/mandate-shared";
import { DetailDrawer } from "./MandateDetailDrawer";

function Section({
  title,
  rows,
  emptyNote,
  org,
  authorities,
  onOpen,
}: {
  title: string;
  rows: MandateEntry[];
  emptyNote: string;
  org: MandateOrg;
  authorities: AuthorityMap;
  onOpen: (id: string) => void;
}) {
  if (!rows.length && !emptyNote) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-h">
        <h3>{title}</h3>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>
            {emptyNote}
          </p>
        ) : (
          <div className="tw" style={{ border: "none", boxShadow: "none" }}>
            <table className="auth3">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Power or duty</th>
                  <th>Conditions and limits</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const flags = flagsFor(e, org, authorities);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => onOpen(e.id)}>
                      <td className="ref">{e.ref || "—"}</td>
                      <td>{e.description}</td>
                      <td>
                        <span className="cond">{e.conditions || "—"}</span>
                        {flags.length > 0 && (
                          <div className="flags">
                            {flags.map((f, i) => (
                              <span key={i} className={`flag ${f.cls}`}>
                                {f.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function MandateAuthorityClient({
  orgs,
  org,
  entries,
  authorities: authorityList,
  instruments,
  canPropose,
}: {
  orgs: { id: string; name: string }[];
  org: MandateOrg;
  entries: MandateEntry[];
  authorities: MandateAuthority[];
  instruments: MandateInstrument[];
  canPropose?: boolean;
}) {
  const router = useRouter();
  const authorities = useMemo(() => authorityMap(authorityList), [authorityList]);
  const [postId, setPostId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const options = useMemo(() => authorityOptions(authorityList, null), [authorityList]);
  const a = postId ? authorities.get(postId) ?? null : null;

  const { holds, personal, subs, owns, duties, liveCount } = useMemo(() => {
    if (!a) return { holds: [], personal: [], subs: [], owns: [], duties: [], liveCount: 0 };
    const heldBy = (e: MandateEntry) => delegatesOf(e).includes(a.id);
    const holds = entries.filter((e) => heldBy(e) && e.status === "delegated");
    const personal = entries.filter(
      (e) => e.status === "delegated" && e.delegatingAuthorityIds.includes(a.id) && delegatesOf(e).length === 0
    );
    const subs = entries.filter((e) => e.subDelegateIds.includes(a.id));
    const owns = entries.filter((e) => e.delegatingAuthorityIds.includes(a.id));
    const duties = entries.filter((e) => e.status === "not_delegable" && e.delegatingAuthorityIds.includes(a.id));
    const live = liveInstruments(instruments).filter((i) => i.toPostId === a.id);
    return { holds, personal, subs, owns, duties, liveCount: live.length };
  }, [a, entries, instruments]);

  const detailEntry = detailId ? entries.find((e) => e.id === detailId) ?? null : null;

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
      {orgs.length > 1 && (
        <div className="btnrow" style={{ marginBottom: 14 }}>
          <span className="eyebrow" style={{ marginBottom: 0 }}>
            Client
          </span>
          <select
            value={org.id}
            onChange={(ev) => router.push(`/mandate/authority?org=${ev.target.value}`)}
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
          <div className="eyebrow gold">Authority</div>
          <h1 className="serif">Who may do what</h1>
        </div>
      </div>
      <p className="pnote">Pick a post or body to see everything it holds directly, may receive by sub-delegation, and cannot delegate away.</p>

      <div className="filters">
        <div className="f grow">
          <span>Post or body</span>
          <select
            value={postId}
            onChange={(ev) => setPostId(ev.target.value)}
          >
            <option value="">Choose a post or body…</option>
            {options.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!a ? (
        <div className="empty">
          <h3>Choose a post or body.</h3>
          <p className="muted">Nothing is shown until you pick one from the list above.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <h2 className="serif" style={{ margin: 0, fontSize: 20 }}>
                  {a.name}
                </h2>
                {a.short && <span className="pill automatic">{a.short}</span>}
                {a.vacant && <span className="pill not_delegable">Vacant</span>}
              </div>
              <p className="muted" style={{ margin: "0 0 14px" }}>
                {[a.incumbent, a.department, a.jeLevel].filter(Boolean).join(" · ") || "No incumbent, department or JE level recorded."}
              </p>
              {a.vacant && (
                <div className="note b" style={{ marginBottom: 14 }}>
                  This post is currently vacant. Anything shown below still applies to the post - it is simply not being
                  exercised until it is filled.
                </div>
              )}
              <div className="cards c4">
                <div className="stat">
                  <div className="k">Holds</div>
                  <div className="v">{(holds.length + personal.length).toLocaleString("en-ZA")}</div>
                  <div className="s">Held directly</div>
                </div>
                <div className="stat">
                  <div className="k">May receive</div>
                  <div className="v">{subs.length.toLocaleString("en-ZA")}</div>
                  <div className="s">By sub-delegation</div>
                </div>
                <div className="stat">
                  <div className="k">Delegates</div>
                  <div className="v">{owns.length.toLocaleString("en-ZA")}</div>
                  <div className="s">Passed on to others</div>
                </div>
                <div className="stat">
                  <div className="k">Live instruments</div>
                  <div className="v">{liveCount.toLocaleString("en-ZA")}</div>
                  <div className="s">Currently in force</div>
                </div>
              </div>
            </div>
          </div>

          <Section
            title="Powers held directly"
            rows={holds}
            emptyNote="Nothing is delegated to this post."
            org={org}
            authorities={authorities}
            onOpen={setDetailId}
          />
          {personal.length > 0 && (
            <Section
              title="Powers it exercises itself, delegated to no one"
              rows={personal}
              emptyNote=""
              org={org}
              authorities={authorities}
              onOpen={setDetailId}
            />
          )}
          <Section
            title="Powers it may receive by sub-delegation"
            rows={subs}
            emptyNote="This post is not named as a sub-delegate anywhere."
            org={org}
            authorities={authorities}
            onOpen={setDetailId}
          />
          {duties.length > 0 && (
            <Section
              title="Duties it cannot delegate away"
              rows={duties}
              emptyNote=""
              org={org}
              authorities={authorities}
              onOpen={setDetailId}
            />
          )}
          {owns.length > 0 && a.kind === "body" && (
            <Section
              title="Powers it delegates to others"
              rows={owns}
              emptyNote=""
              org={org}
              authorities={authorities}
              onOpen={setDetailId}
            />
          )}
        </>
      )}

      {detailEntry && (
        <DetailDrawer
          entry={detailEntry}
          org={org}
          authorities={authorities}
          onClose={() => setDetailId(null)}
          canPropose={canPropose}
        />
      )}
    </div>
  );
}
