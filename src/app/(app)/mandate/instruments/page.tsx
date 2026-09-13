import {
  getMandateOrgs,
  getMandateEntries,
  getMandateAuthorities,
  getMandateInstruments,
  authorityMap,
  authorityOptions,
  hasMandatePermission,
} from "@/lib/data/mandate";
import { InstrumentsClient } from "./InstrumentsClient";
import "../mandate.css";

/**
 * Instruments - the individual letters/certificates that give effect to a
 * delegation row (who it was issued to, when, and whether it's currently
 * live). Read-only table plus the "Issue instrument" creation drawer
 * (InstrumentsClient), ported from assets/edit.js's drawInstrument().
 */
export default async function MandateInstrumentsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [entries, authorityList, instruments, canEdit] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateInstruments(selected.id),
    hasMandatePermission(selected.id, "edit_mandate_register"),
  ]);
  const authorities = authorityMap(authorityList);

  return (
    <div className="mandate">
      <InstrumentsClient
        orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
        currentOrgId={selected.id}
        entries={entries}
        authorities={authorityOptions(authorityList)}
        authorityMap={authorities}
        instruments={instruments}
        canEdit={canEdit}
      />
    </div>
  );
}
