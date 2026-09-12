import { getMandateOrgs, getMandateEntries, getMandateAuthorities, getMandateDecisions, authorityMap, mandateMoney } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Decision log - the record of individual decisions taken under delegated
 * powers (ported from views.js's decision-log table). Read-only for now;
 * recording a new decision is an admin action that lands with #206.
 */
export default async function MandateDecisionsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [entries, authorityList, decisions] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateDecisions(selected.id),
  ]);
  const authorities = authorityMap(authorityList);
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const categoryLabel = new Map(selected.categories.map((c) => [c.id, c.label]));

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1300, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/decisions" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Operate</div>
            <h1 className="serif">Decision log</h1>
          </div>
        </div>
        <p className="pnote">Individual decisions taken under a delegated power, with the amount, category and reporting status of each.</p>

        {decisions.length === 0 ? (
          <div className="empty">
            <h3>Nothing here yet.</h3>
            <p className="muted">No decisions have been logged for this register.</p>
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
                  const taker = d.takenById ? authorities.get(d.takenById) : null;
                  return (
                    <tr key={d.id}>
                      <td className="nowrap mono small">{d.decidedOn || "—"}</td>
                      <td className="ref">{e?.ref || "—"}</td>
                      <td>{d.summary}</td>
                      <td>{taker ? taker.name : "—"}</td>
                      <td className="nowrap right">{d.amount != null ? mandateMoney(d.amount) : ""}</td>
                      <td className="small">{d.category ? (categoryLabel.get(d.category) ?? d.category) : ""}</td>
                      <td>
                        {d.reportedOn ? (
                          <span className="pill accepted">{d.reportedOn}</span>
                        ) : (
                          <span className="pill issued">Not yet</span>
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
