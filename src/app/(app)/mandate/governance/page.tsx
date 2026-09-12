import {
  getMandateOrgs,
  getMandateEntries,
  getMandateAuthorities,
  hasMandatePermission,
} from "@/lib/data/mandate";
import { getMandateChanges, getMandateVersions, getMandateWorkflowEvents } from "@/lib/data/mandate-governance";
import { createClient } from "@/lib/supabase/server";
import { GovernanceClient } from "./GovernanceClient";
import "../mandate.css";

/**
 * Mandate governance workspace entry point - ported from assets/
 * governance.js's page(). Fetches everything the four tabs (Dashboard, My
 * changes, Approval queue, History) need up front and hands it to the
 * client component, which does all the tab switching/filtering/modals. The
 * reference's fifth tab, "User access", is intentionally not built here -
 * per the project's decision to fold Mandate access into performaxis-gov's
 * existing RBAC, granting access happens on the Manage Users screen instead.
 */
export default async function MandateGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; entry?: string }>;
}) {
  const { org: orgParam, entry: entryParam } = await searchParams;
  const orgs = await getMandateOrgs();

  if (orgs.length === 0) {
    return (
      <div className="mandate">
        <p className="muted" style={{ padding: 24 }}>
          You don&apos;t have access to Mandate governance yet - ask your Municipal Admin to grant you the
          &quot;view_mandate&quot; permission.
        </p>
      </div>
    );
  }

  const selected = orgs.find((o) => o.id === orgParam) ?? orgs[0];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [entries, authorities, changes, versions, events, canPropose, canDecide, canManage] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateChanges(selected.id),
    getMandateVersions(selected.id),
    getMandateWorkflowEvents(selected.id),
    hasMandatePermission(selected.id, "edit_mandate_register"),
    hasMandatePermission(selected.id, "approve_mandate_changes"),
    hasMandatePermission(selected.id, "manage_mandate_setup"),
  ]);

  return (
    <div className="mandate">
      <GovernanceClient
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        org={selected}
        entries={entries}
        authorities={authorities}
        changes={changes}
        versions={versions}
        events={events}
        canPropose={canPropose}
        canDecide={canDecide}
        canManage={canManage}
        initialEntryId={entryParam || null}
        currentUserId={user?.id || null}
      />
    </div>
  );
}
