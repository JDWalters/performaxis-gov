import { getMandateOrgs, hasMandatePermission } from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Settings - ported from the reference app's `settings` view (assets/views.js),
 * scoped down to what's actually meaningful in this app. The reference's
 * three cards don't map cleanly onto a multi-tenant Supabase app:
 *
 *  - "Naming" (product name / footer owner) is a global label for a single
 *    browser's local copy of Mandate. Here the equivalent per-client naming
 *    (instrument title, version, governing body) already lives on the org
 *    record and is shown throughout the module (Overview, topbar pill,
 *    Organisations) - repeated here as a read-only summary rather than a
 *    second editable copy of the same fields.
 *  - "Backup and restore" (export/import a JSON blob, because the reference
 *    stores everything in localStorage) has no equivalent - this app's data
 *    lives in Supabase behind RLS, with its own backup story at the database
 *    level, not the browser.
 *  - "Reset" (wipe localStorage and reseed the sample) is meaningless outside
 *    the reference's own demo data.
 *
 * What's shown instead: the org's Mandate naming (read-only) and this user's
 * own Mandate permissions, which is the access-control question "Settings"
 * actually answers in a permissioned multi-tenant app.
 */
export default async function MandateSettingsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [canView, canEdit, canManageSetup] = await Promise.all([
    hasMandatePermission(selected.id, "view_mandate"),
    hasMandatePermission(selected.id, "edit_mandate_register"),
    hasMandatePermission(selected.id, "manage_mandate_setup"),
  ]);

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 800, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/settings" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Manage</div>
            <h1 className="serif">Settings</h1>
          </div>
        </div>
        <p className="pnote">Naming for this client&apos;s register, and your own access to it.</p>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-h">
            <h3>Naming</h3>
          </div>
          <div className="card-b">
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, columnGap: 14 }}>
              <div className="muted small">Organisation</div>
              <div>{selected.name}</div>
              <div className="muted small">Instrument</div>
              <div>
                {selected.instrumentTitle} · v{selected.version}
              </div>
              <div className="muted small">Governing body</div>
              <div>{selected.governingBody}</div>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              These names are set on the organisation record. Ask your Municipal Admin to change them via Org Management.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Your access to this register</h3>
          </div>
          <div className="card-b">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <span className={`pill ${canView ? "delegated" : "not_delegable"}`}>{canView ? "Granted" : "Not granted"}</span>{" "}
                View the register
              </div>
              <div>
                <span className={`pill ${canEdit ? "delegated" : "not_delegable"}`}>{canEdit ? "Granted" : "Not granted"}</span>{" "}
                Edit entries, issue instruments and log decisions
              </div>
              <div>
                <span className={`pill ${canManageSetup ? "delegated" : "not_delegable"}`}>
                  {canManageSetup ? "Granted" : "Not granted"}
                </span>{" "}
                Manage posts, bodies and by-law setup
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Permissions are granted per organisation under Manage Users, using this app&apos;s own role system rather than a
              separate Mandate login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
