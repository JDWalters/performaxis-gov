import { getMandateOrgs, getMandateOutstandingItems, getMandateAuthorities, authorityMap } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Outstanding items (Annexure F) - read-only, ported from the reference
 * app's `outstanding` view (assets/views.js), including its sort (open
 * items first, then by "no") and the closed-note shown under a closed item.
 * The reference also lets an admin add an item and close/reopen one inline
 * (window.EDIT.closeOutstanding) - scoped down to a list here for the same
 * reason as Financial limits: these are prepared during the register build,
 * not day-to-day data entry, so read-only is the right first cut.
 */
export default async function MandateOutstandingPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [items, authorityList] = await Promise.all([getMandateOutstandingItems(selected.id), getMandateAuthorities(selected.id)]);
  const authorities = authorityMap(authorityList);

  const rows = items
    .slice()
    .sort((a, b) => (a.status === b.status ? (a.no || 0) - (b.no || 0) : a.status === "closed" ? 1 : -1));

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1200, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/outstanding" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Annexure F</div>
            <h1 className="serif">Outstanding items</h1>
          </div>
        </div>
        <p className="pnote">
          Each one blocks or qualifies part of the register. Close an item once the document or decision it waits on exists.
        </p>

        {rows.length === 0 ? (
          <div className="empty">
            <h3>Nothing outstanding.</h3>
            <p className="muted">Add an item when the register depends on something you do not have yet.</p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Item</th>
                  <th>Entries affected</th>
                  <th>Responsible</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const resp = r.responsibleId ? authorities.get(r.responsibleId) : null;
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.no ?? ""}</td>
                      <td>
                        <div>{r.item}</div>
                        {r.status === "closed" && r.closedNote && (
                          <div className="small muted" style={{ marginTop: 4 }}>
                            Closed: {r.closedNote}
                          </div>
                        )}
                      </td>
                      <td className="mono small">{r.affects || ""}</td>
                      <td className="small">{resp ? resp.name : ""}</td>
                      <td>
                        <span className={`pill ${r.status === "closed" ? "closed" : "open"}`}>
                          {r.status === "closed" ? "Closed" : "Open"}
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
