import { getMandateOrgs, getMandateAuthorities, hasMandatePermission } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../../MandateOrgSwitcher";
import { StructureClient } from "./StructureClient";
import "../../mandate.css";

/** Posts and bodies - ported from views.js's structure()/admin.js's editAuth. */
export default async function MandateStructurePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [authorities, canManage] = await Promise.all([
    getMandateAuthorities(selected.id),
    hasMandatePermission(selected.id, "manage_mandate_setup"),
  ]);

  if (!canManage) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          Posts and bodies are administrator-only. Ask your Municipal Admin for the &quot;manage_mandate_setup&quot;
          permission.
        </p>
      </div>
    );
  }

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 0" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/admin/structure" />
      </div>
      <StructureClient orgId={selected.id} authorities={authorities} />
    </div>
  );
}
