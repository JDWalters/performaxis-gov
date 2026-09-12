import { getMandateOrgs, getMandateEntries, getMandateAuthorities, hasMandatePermission } from "@/lib/data/mandate";
import { MandateRegisterClient } from "./MandateRegisterClient";
import "./mandate.css";

/**
 * The Mandate delegation register's entry point - fetches the signed-in
 * user's accessible Mandate orgs (RLS via has_org_access already limits
 * mandate_entries/mandate_authorities to what they can see; getMandateOrgs
 * just narrows the org picker to municipality/water_board kinds) and hands
 * everything to the client component that does the actual filtering/sorting
 * /paging/detail-drawer work, matching the reference app's register.js.
 */
export default async function MandatePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [entries, authorities, canManage, canPropose] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    hasMandatePermission(selected.id, "manage_mandate_setup"),
    hasMandatePermission(selected.id, "edit_mandate_register"),
  ]);

  return (
    <div className="mandate">
      <MandateRegisterClient
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        org={selected}
        entries={entries}
        authorities={authorities}
        canManage={canManage}
        canPropose={canPropose}
      />
    </div>
  );
}
