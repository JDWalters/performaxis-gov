import Link from "next/link";
import {
  getMandateOrgs,
  getMandateEntries,
  getMandateAuthorities,
  getMandateInstruments,
  getMandateDecisions,
  getMandateThresholds,
  getMandateOutstandingItems,
  authorityMap,
  delegatesOf,
  thresholdIsBlank,
  blockedEntryRefs,
  openOutstandingItems,
} from "@/lib/data/mandate";
import { MandateOrgSwitcher } from "../MandateOrgSwitcher";
import "../mandate.css";

/**
 * Overview - the register's landing screen: four headline figures, a "what
 * needs attention" alert list and a per-schedule breakdown. Ported from the
 * reference app's `overview` view (assets/views.js) - every alert condition
 * and count below is a line-for-line port of that function's logic.
 *
 * The reference makes each alert row and each figure clickable (jumping to
 * the filtered register/instruments/etc). Ported here as plain links to the
 * destination screen rather than reproducing the reference's client-side
 * schedule/status filter state, since this app's register page doesn't (yet)
 * accept a schedule query param - the destination screens themselves are
 * unchanged.
 */
export default async function MandateOverviewPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const [entries, authorityList, instruments, decisions, thresholds, outstanding] = await Promise.all([
    getMandateEntries(selected.id),
    getMandateAuthorities(selected.id),
    getMandateInstruments(selected.id),
    getMandateDecisions(selected.id),
    getMandateThresholds(selected.id),
    getMandateOutstandingItems(selected.id),
  ]);
  const authorities = authorityMap(authorityList);

  const counts = entries.reduce<Record<string, number>>((a, e) => {
    a[e.status] = (a[e.status] || 0) + 1;
    return a;
  }, {});

  // "n delegations sit with a vacant post" - every delegatesOf() id, across every entry, that resolves to a vacant post.
  const vacant = entries.flatMap((e) =>
    delegatesOf(e)
      .map((id) => authorities.get(id))
      .filter((a): a is NonNullable<typeof a> => !!a && a.kind === "post" && a.vacant)
      .map((post) => ({ entry: e, post }))
  );
  const vacantPostNames = Array.from(new Set(vacant.map((v) => v.post.name)));

  // "n powers are blocked by a blank financial limit" - entries whose ref is named in a blank threshold's item text.
  const blocked = blockedEntryRefs(thresholds);
  const blockedEntries = entries.filter((e) => blocked.has(e.ref));

  const pendingAcceptance = instruments.filter((i) => i.status === "issued" && !i.acceptedOn);
  const unreported = decisions.filter((d) => !d.reportedOn);
  const open = openOutstandingItems(outstanding);
  const blanks = thresholds.filter(thresholdIsBlank);

  type Alert = { n: number; t: string; d: string; cls: "bad" | "warn"; go: string };
  const alerts: Alert[] = [];
  if (vacant.length) {
    alerts.push({
      n: vacant.length,
      t: "delegations sit with a vacant post",
      d: `${vacantPostNames.join(", ")} — until filled these are exercised by the immediate superior.`,
      cls: "bad",
      go: "/mandate/admin/structure",
    });
  }
  if (blockedEntries.length) {
    alerts.push({
      n: blockedEntries.length,
      t: "powers are blocked by a blank financial limit",
      d: `${blockedEntries.map((e) => e.ref).join(", ")} — a power with no limit set may not be exercised.`,
      cls: "bad",
      go: "/mandate/limits",
    });
  }
  if (pendingAcceptance.length) {
    alerts.push({
      n: pendingAcceptance.length,
      t: "instruments are issued but not yet accepted",
      d: "A delegation takes effect only on written acceptance.",
      cls: "warn",
      go: "/mandate/instruments",
    });
  }
  if (unreported.length) {
    alerts.push({
      n: unreported.length,
      t: `decisions have not been reported to ${selected.governingBody || "the governing body"}`,
      d: "Include them in the next standing report.",
      cls: "warn",
      go: "/mandate/reports",
    });
  }
  if (open.length) {
    alerts.push({
      n: open.length,
      t: "outstanding items are still open",
      d: "Each one blocks or qualifies part of the register.",
      cls: "warn",
      go: "/mandate/outstanding",
    });
  }
  if (blanks.length) {
    alerts.push({
      n: blanks.length,
      t: "financial limits have not been set",
      d: blanks
        .slice(0, 3)
        .map((t) => t.item)
        .join("; ") + (blanks.length > 3 ? "…" : ""),
      cls: "warn",
      go: "/mandate/limits",
    });
  }

  return (
    <div className="mandate">
      <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1200, margin: "0 auto" }}>
        <MandateOrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} currentOrgId={selected.id} basePath="/mandate/overview" />

        <div className="phead">
          <div>
            <div className="eyebrow gold">Register</div>
            <h1 className="serif">Overview</h1>
          </div>
        </div>
        <p className="pnote">
          {selected.instrumentTitle} · v{selected.version}
        </p>

        <div className="cards c4" style={{ marginBottom: 18 }}>
          <div className="stat">
            <div className="k">Entries</div>
            <div className="v">{entries.length}</div>
            <div className="s">{selected.schedules.length} schedules</div>
          </div>
          <div className="stat">
            <div className="k">Delegated</div>
            <div className="v">{counts.delegated || 0}</div>
            <div className="s">exercised by an official</div>
          </div>
          <div className="stat warn">
            <div className="k">Reserved</div>
            <div className="v">{counts.reserved || 0}</div>
            <div className="s">must be decided by {selected.governingBody || "the governing body"}</div>
          </div>
          <div className="stat bad">
            <div className="k">Not delegable</div>
            <div className="v">{counts.not_delegable || 0}</div>
            <div className="s">personal statutory duties</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-h">
            <h3>What needs attention</h3>
          </div>
          <div className="card-b">
            {alerts.length === 0 ? (
              <div className="note g">
                <strong>Nothing outstanding. </strong>
                Every delegation is accepted, every limit is set and every decision has been reported.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((a, i) => (
                  <div key={i} className={`note ${a.cls === "bad" ? "d" : "b"}`} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                      {a.n}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{a.t}</div>
                      <div style={{ marginTop: 2 }}>{a.d}</div>
                    </div>
                    <Link href={`${a.go}?org=${selected.id}`} className="btn sm">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Title</th>
                <th>Entries</th>
                <th>Delegated</th>
                <th>Reserved</th>
                <th>Not delegable</th>
              </tr>
            </thead>
            <tbody>
              {selected.schedules.map((s) => {
                const rows = entries.filter((e) => e.schedule === s.code);
                const c = rows.reduce<Record<string, number>>((a, e) => {
                  a[e.status] = (a[e.status] || 0) + 1;
                  return a;
                }, {});
                return (
                  <tr key={s.code}>
                    <td>
                      <span className="ref">{s.code}</span>
                    </td>
                    <td>{s.title}</td>
                    <td className="mono">{rows.length}</td>
                    <td className="mono">{c.delegated || 0}</td>
                    <td className="mono">{c.reserved || 0}</td>
                    <td className="mono">{c.not_delegable || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
