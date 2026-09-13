import { getMandateOrgs, getMandateThresholds, getMandateAuthorities, authorityMap, mandateMoney, thresholdIsBlank } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Financial limits (Annexure B) - read-only, ported from the reference
 * app's `limits` view (assets/views.js). The reference also lets an admin
 * add/edit a limit inline (window.EDIT.threshold) - scoped down to a list
 * here, matching the "list first" level the Instruments/Decisions screens
 * started at, since editing limits is rarer and higher-stakes than reading
 * them (every power's exercise depends on getting the figure right).
 */
export default async function MandateLimitsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [thresholds, authorityList] = await Promise.all([getMandateThresholds(selected.id), getMandateAuthorities(selected.id)]);
  const authorities = authorityMap(authorityList);

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/limits" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Annexure B</div>
            <h1 className="serif">Financial limits</h1>
          </div>
        </div>
        <p className="pnote">A power whose limit is blank may not be exercised until the governing body sets it.</p>

        {thresholds.length === 0 ? (
          <div className="empty">
            <h3>No limits captured.</h3>
            <p className="muted">Add the values from the financial manual, supply chain policy and bank mandate.</p>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Authority</th>
                  <th>Limit</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t) => {
                  const blank = thresholdIsBlank(t);
                  const a = t.authorityId ? authorities.get(t.authorityId) : null;
                  return (
                    <tr key={t.id}>
                      <td>{t.item}</td>
                      <td className="small">{a ? a.name : "—"}</td>
                      <td>
                        {blank ? (
                          <span className="pill reserved">Not set — blocks the power</span>
                        ) : (
                          <span className="mono">{t.amount != null ? mandateMoney(t.amount) : t.wording}</span>
                        )}
                      </td>
                      <td className="small muted">{t.source || ""}</td>
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
