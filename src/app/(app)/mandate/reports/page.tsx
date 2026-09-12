import { getMandateOrgs, getMandateEntries, getMandateAuthorities, getMandateDecisions, authorityMap, hasMandatePermission } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import { ReportsClient } from "./ReportsClient";
import "../mandate.css";

export default async function MandateReportsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [entries, authorityList, decisions, canMark] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateDecisions(selected.id),
    hasMandatePermission(selected.id, "edit_mandate_register"),
  ]);

  return (
    <div className="mandate">
      <div style={{ padding: "24px 26px 0" }} className="noprint">
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/reports" />
      </div>
      <ReportsClient org={selected} entries={entries} authorities={authorityMap(authorityList)} decisions={decisions} canMark={canMark} />
    </div>
  );
}
