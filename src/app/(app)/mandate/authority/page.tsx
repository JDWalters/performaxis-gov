import { getMandateOrgs, getMandateEntries, getMandateAuthorities, getMandateInstruments, hasMandatePermission } from "@/lib/data/mandate";
import { MandateAuthorityClient } from "../MandateAuthorityClient";
import "../mandate.css";

/** "Who may do what" - same org-resolution pattern as the register's page.tsx. */
export default async function MandateAuthorityPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams;
  const orgs = await getMandateOrgs();

  if (orgs.length === 0) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          You don&apos;t have access to a Mandate delegation register yet - ask your Municipal Admin to grant you
          the &quot;view_mandate&quot; permission.
        </p>
      </div>
    );
  }

  const selected = orgs.find((o) => o.id === orgParam) ?? orgs[0];
  const [entries, authorities, instruments, canPropose] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateInstruments(selected.id),
    hasMandatePermission(selected.id, "edit_mandate_register"),
  ]);

  return (
    <div className="mandate">
      <MandateAuthorityClient
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        org={selected}
        entries={entries}
        authorities={authorities}
        instruments={instruments}
        canPropose={canPropose}
      />
    </div>
  );
}
