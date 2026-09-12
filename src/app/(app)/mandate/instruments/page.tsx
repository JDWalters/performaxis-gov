import {
  getMandateOrgs,
  getMandateEntries,
  getMandateAuthorities,
  getMandateInstruments,
  authorityMap,
  liveInstruments,
} from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Instruments - the individual letters/certificates that give effect to a
 * delegation row (who it was issued to, when, and whether it's currently
 * live). Read-only for now; issuing/withdrawing an instrument is an admin
 * action that lands with the rest of task #206's admin screens.
 */
export default async function MandateInstrumentsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams;
  const orgs = await getMandateOrgs();

  if (orgs.length === 0) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          You don&apos;t have access to Mandate yet - ask your Municipal Admin to grant you the
          &quot;view_mandate&quot; permission.
        </p>
      </div>
    );
  }

  const selected = orgs.find((o) => o.id === orgParam) ?? orgs[0];
  const [entries, authorityList, instruments] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateInstruments(selected.id),
  ]);
  const authorities = authorityMap(authorityList);
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const live = new Set(liveInstruments(instruments).map((i) => i.id));

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1200, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/instruments" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Operate</div>
            <h1 className="serif">Instruments</h1>
          </div>
        </div>
        <p className="pnote">The individual instruments that give effect to a delegation - who it was issued to, when, and whether it is currently in force.</p>

        {instruments.length === 0 ? (
          <div className="empty">
            <h3>Nothing here yet.</h3>
            <p className="muted">No instruments have been recorded for this register.</p>
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
                  const fromA = i.fromPostId ? authorities.get(i.fromPostId) : null;
                  const toA = i.toPostId ? authorities.get(i.toPostId) : null;
                  return (
                    <tr key={i.id}>
                      <td className="ref">{e?.ref || "—"}</td>
                      <td>{fromA ? fromA.short || fromA.name : "—"}</td>
                      <td>{toA ? toA.short || toA.name : "—"}</td>
                      <td className="nowrap">{i.issuedOn || "—"}</td>
                      <td className="nowrap">{i.acceptedOn || "—"}</td>
                      <td className="nowrap">{i.withdrawnOn || "—"}</td>
                      <td>
                        <span className={`pill ${live.has(i.id) ? "accepted" : i.status}`}>
                          {live.has(i.id) ? "In force" : i.status}
                        </span>
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
