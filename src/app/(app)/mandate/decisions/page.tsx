import {
  getMandateOrgs,
  getMandateOrg,
  getMandateEntries,
  getMandateAuthorities,
  getMandateDecisions,
  authorityMap,
  authorityOptions,
  hasMandatePermission,
} from "@/lib/data/mandate";
import { DecisionsClient } from "./DecisionsClient";
import "../mandate.css";

/**
 * Decision log - the record of individual decisions taken under delegated
 * powers (ported from views.js's decision-log table). Read-only table plus
 * the "Log decision" creation drawer (DecisionsClient), ported from
 * assets/edit.js's drawDecision().
 */
export default async function MandateDecisionsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [org, entries, authorityList, decisions, canEdit] = await Promise.all([
    getMandateOrg(selected.id),
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateDecisions(selected.id),
    hasMandatePermission(selected.id, "edit_mandate_register"),
  ]);
  const authorities = authorityMap(authorityList);

  return (
    <div className="mandate">
      <DecisionsClient
        org={org ?? selected}
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        currentOrgId={selected.id}
        entries={entries}
        authorities={authorityOptions(authorityList)}
        authorityMap={authorities}
        decisions={decisions}
        canEdit={canEdit}
      />
    </div>
  );
}
