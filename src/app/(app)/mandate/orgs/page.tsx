import Link from "next/link";
import { getMandateOrgs, getMandateOrgCounts } from "@/lib/data/mandate";
import "../mandate.css";

/**
 * Organisations - the list of Mandate clients this user can see, ported
 * from the reference app's `orgs` view (assets/views.js: name / instrument
 * / entries / posts / open items, click a row to switch the active client).
 * The reference's "Add organisation" creation drawer isn't ported - in this
 * app an org is a full multi-tenant PerformAxis org (created via Org
 * Management, gated on manage_orgs), not something a Mandate user creates
 * from within the module.
 */
export default async function MandateOrgsPage() {
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

  const counts = await Promise.all(orgs.map((o) => getMandateOrgCounts(o.id)));

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="phead">
          <div>
            <div className="eyebrow gold">Manage</div>
            <h1 className="serif">Organisations</h1>
          </div>
        </div>
        <p className="pnote">Each client has its own register, structure, limits and log. Nothing is shared between them.</p>

        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Instrument</th>
                <th>Entries</th>
                <th>Posts</th>
                <th>Open items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => {
                const c = counts[i];
                return (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.name}</strong>
                    </td>
                    <td className="small muted">
                      {o.instrumentTitle}
                      {o.version ? ` v${o.version}` : ""}
                    </td>
                    <td className="mono">{c.entries}</td>
                    <td className="mono">{c.posts}</td>
                    <td className="mono">{c.openItems}</td>
                    <td className="nowrap">
                      <Link href={`/mandate/overview?org=${o.id}`} className="btn sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
