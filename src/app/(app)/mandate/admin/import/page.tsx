import { getMandateOrgs, getMandateAuthorities, hasMandatePermission } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../../MandateOrgSwitcher";
import { ImportClient } from "./ImportClient";
import "../../mandate.css";

/** Bulk load - ported from admin.js's importPage(). Reachable from the By-law library screen's "Create a pack from a CSV" button (the reference has no other entry point for this screen either - it isn't in the reference's own top-level NAV). */
export default async function MandateImportPage({ searchParams }: { searchParams: Promise<{ org?: string; pack?: string }> }) {
  const { org: orgParam, pack: packParam } = await searchParams;
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
  const [authorities, canManage] = await Promise.all([
    getMandateAuthorities(selected.id),
    hasMandatePermission(selected.id, "manage_mandate_setup"),
  ]);

  if (!canManage) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          Only an administrator may import delegations. Ask your Municipal Admin for the &quot;manage_mandate_setup&quot;
          permission.
        </p>
      </div>
    );
  }

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 0" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/admin/import" />
      </div>
      <ImportClient
        orgId={selected.id}
        authorities={authorities.map((a) => ({ id: a.id, name: a.name, short: a.short }))}
        startAsPack={packParam === "1"}
      />
    </div>
  );
}
