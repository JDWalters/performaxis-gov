import { getMandateOrgs, getMandateBylawPacks, getBylawAdoptedCounts, hasMandatePermission } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../../MandateOrgSwitcher";
import { LibraryClient } from "./LibraryClient";
import "../../mandate.css";

/** By-law library - ported from library.js. Browse the 27 pre-built delegation packs and adopt one onto (or remove one from) the current org's live register. */
export default async function MandateLibraryPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [packs, canManage] = await Promise.all([getMandateBylawPacks(), hasMandatePermission(selected.id, "manage_mandate_setup")]);

  if (!canManage) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          The by-law library is administrator-only. Ask your Municipal Admin for the &quot;manage_mandate_setup&quot;
          permission.
        </p>
      </div>
    );
  }

  const adopted = await getBylawAdoptedCounts(selected.id);

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 0" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/admin/library" />
      </div>
      <LibraryClient orgId={selected.id} packs={packs} adopted={Object.fromEntries(adopted)} />
    </div>
  );
}
