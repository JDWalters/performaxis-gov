/**
 * Mandate types and pure helpers - split out from mandate.ts so client
 * components (the register table, filters, detail drawer) can import them
 * without pulling in @/lib/supabase/server (which drags in next/headers and
 * breaks client bundling - the same reason kpi-calc-shared.ts exists
 * alongside scorecards.ts). Field names are camelCase, matching the
 * reference app's own in-memory shape (assets/app.js/register.js) rather
 * than the snake_case mandate_* DB columns - every helper below is a
 * line-for-line port of assets/register.js.
 */

export type MandateOrg = {
  id: string;
  name: string;
  shortName: string;
  kind: string;
  instrumentTitle: string;
  version: string;
  governingBody: string;
  schedules: { tab: string; code: string; title: string }[];
  categories: { id: string; label: string }[];
};

export type MandateAuthority = {
  id: string;
  orgId: string;
  kind: string; // 'post' | 'body' | 'group'
  name: string;
  short: string | null;
  incumbent: string | null;
  department: string | null;
  jeLevel: string | null;
  vacant: boolean;
  note: string | null;
};

export type MandateEntry = {
  id: string;
  orgId: string;
  ref: string;
  schedule: string | null;
  band: string | null;
  provision: string | null;
  legislation: string | null;
  sourceLegislation: string | null;
  description: string;
  delegatingAuthorityIds: string[];
  delegatingAuthorityNote: string | null;
  status: string; // 'delegated' | 'reserved' | 'not_delegable' | 'automatic'
  delegatedBodyIds: string[];
  delegatedBodyNote: string | null;
  delegateIds: string[];
  delegateNote: string | null;
  subDelegateIds: string[];
  subDelegateNote: string | null;
  subDelegateNone: boolean;
  furtherSubDelegateIds: string[];
  furtherSubDelegateNote: string | null;
  conditions: string | null;
  reportingCategory: string | null;
  thresholdLinked: boolean;
  pajaLinked: boolean;
  reviewStatus: string | null;
  reviewNote: string | null;
  establishmentNote: string | null;
  sourceRef: string | null;
  instrumentType: string | null;
  instrumentToConfirm: boolean;
};

export type AuthorityMap = Map<string, MandateAuthority>;

export function authorityMap(authorities: MandateAuthority[]): AuthorityMap {
  return new Map(authorities.map((a) => [a.id, a]));
}

/** Who actually holds the power - delegateIds first, falling back to delegatedBodyIds (see app.js's delegatesOf). */
export function delegatesOf(e: MandateEntry): string[] {
  return e.delegateIds.length ? e.delegateIds : e.delegatedBodyIds;
}

function chainIds(e: MandateEntry): string[] {
  return [
    ...e.delegatingAuthorityIds,
    ...e.delegatedBodyIds,
    ...e.delegateIds,
    ...e.subDelegateIds,
    ...e.furtherSubDelegateIds,
  ];
}
function holderIds(e: MandateEntry): string[] {
  return [...e.delegatedBodyIds, ...e.delegateIds, ...e.subDelegateIds, ...e.furtherSubDelegateIds];
}

const NEEDS_CONFIRM = /confirmation required|verification required/i;
const STATUTORY = /confirm delegability|statutory duty/i;

export type Alignment = "aligned" | "action" | "reserved" | "statutory";
export const ALIGN_LABEL: Record<Alignment, string> = {
  aligned: "Aligned",
  action: "Action required",
  reserved: "Council reserved",
  statutory: "Statutory duty",
};

/** Is this row usable as it stands? Ported from register.js's alignment(). */
export function alignment(e: MandateEntry): Alignment {
  if (e.status === "reserved" || e.status === "not_delegable") return "reserved";
  if (e.status === "automatic") return "statutory";
  const hasHolder =
    holderIds(e).length > 0 || !!e.delegatedBodyNote || !!e.delegateNote || !!e.subDelegateNote || !!e.furtherSubDelegateNote;
  if (!hasHolder && STATUTORY.test(e.reviewStatus ?? "")) return "statutory";
  if (!hasHolder && NEEDS_CONFIRM.test(e.reviewStatus ?? "")) return "action";
  return "aligned";
}

/** "No post named - confirm the post on the approved establishment", etc. Ported from register.js's alignmentReason(). */
export function alignmentReason(e: MandateEntry): string {
  const a = alignment(e);
  if (a !== "action") return "";
  const rs = e.reviewStatus ?? "";
  const what = /policy\/structure/i.test(rs)
    ? "confirm the post on the approved establishment"
    : /regulation/i.test(rs)
      ? "confirm the regulation and the post"
      : /collective agreement/i.test(rs)
        ? "confirm the binding collective agreement and the post"
        : /framework/i.test(rs)
          ? "confirm the post, then adopt by resolution"
          : "name the post that holds it";
  return `No post named — ${what}`;
}

export function legislationOf(e: MandateEntry, org: MandateOrg): string {
  if (e.legislation) return e.legislation;
  if (e.band) return e.band;
  const s = org.schedules.find((x) => x.code === e.schedule);
  return s ? s.title : "";
}

/** Strips the org's own instrument-title prefix for display (the underlying value is unchanged). Ported from register.js's legLabel(). */
export function legLabel(l: string, org: MandateOrg | null): string {
  const t = String(l ?? "");
  if (!org) return t;
  const prefix = `${org.name || ""} ${org.instrumentTitle || ""}`;
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escapeRe(prefix)}\\s*[—–:-]\\s*`, "i");
  const short = t.replace(re, "");
  if (short !== t) return short;
  if (t.toLowerCase() === prefix.toLowerCase().trim()) return org.instrumentTitle || t;
  if (org.name) {
    const reName = new RegExp(`^${escapeRe(org.name)}\\s*[—–:-]?\\s+`, "i");
    const s2 = t.replace(reName, "");
    if (s2 !== t && s2) return s2;
  }
  return t;
}

export function postCodes(e: MandateEntry, authorities: AuthorityMap): string[] {
  const out: string[] = [];
  for (const id of chainIds(e)) {
    const a = authorities.get(id);
    if (a && a.kind === "post" && a.short && !out.includes(a.short)) out.push(a.short);
  }
  return out.sort();
}

export function departmentsOf(e: MandateEntry, authorities: AuthorityMap): string[] {
  const out: string[] = [];
  for (const id of chainIds(e)) {
    const a = authorities.get(id);
    if (a && a.department && !out.includes(a.department)) out.push(a.department);
  }
  return out;
}

/** "Chief Financial Officer (FIN-01); Director: Corporate Services (CS-01)" */
export function nameList(ids: string[], note: string | null, authorities: AuthorityMap): string {
  const parts = ids
    .map((id) => {
      const a = authorities.get(id);
      if (!a) return null;
      return a.name + (a.short ? ` (${a.short})` : "");
    })
    .filter((x): x is string => !!x);
  let txt = parts.join("; ");
  if (note) txt = note + (parts.length ? `: ${txt}` : "");
  return txt;
}

export function authorityLabel(e: MandateEntry, authorities: AuthorityMap): string {
  return nameList(e.delegatingAuthorityIds, e.delegatingAuthorityNote, authorities) || "—";
}

export function delegatedToLabel(e: MandateEntry, authorities: AuthorityMap): string {
  return (
    nameList(e.delegateIds, e.delegateNote, authorities) ||
    nameList(e.delegatedBodyIds, e.delegatedBodyNote, authorities) ||
    "—"
  );
}

export function vacantHolder(e: MandateEntry, authorities: AuthorityMap): boolean {
  return delegatesOf(e).some((id) => {
    const a = authorities.get(id);
    return a && a.kind === "post" && a.vacant;
  });
}

export type MandateFlag = { cls: "v" | "b" | "p" | "r"; text: string };

/** "Vacant post" / "Limit applies" / "PAJA" / "Reportable" pills. Ported from app.js's flagsFor(). */
export function flagsFor(e: MandateEntry, org: MandateOrg, authorities: AuthorityMap): MandateFlag[] {
  const f: MandateFlag[] = [];
  if (vacantHolder(e, authorities)) f.push({ cls: "v", text: "Vacant post" });
  if (e.thresholdLinked) f.push({ cls: "b", text: "Limit applies" });
  if (e.pajaLinked) f.push({ cls: "p", text: "PAJA" });
  if (e.reportingCategory && org.categories.some((c) => c.id === e.reportingCategory)) {
    f.push({ cls: "r", text: "Reportable" });
  }
  return f;
}

export type MandateInstrument = {
  id: string;
  orgId: string;
  entryId: string;
  fromPostId: string | null;
  toPostId: string | null;
  conditions: string | null;
  issuedOn: string | null;
  acceptedOn: string | null;
  withdrawnOn: string | null;
  status: string; // 'draft' | 'issued' | 'accepted' | 'withdrawn'
};

/** Is this instrument in force on date d (defaults to today)? Ported from app.js's instrumentLive(). */
export function instrumentLive(i: MandateInstrument, d?: string): boolean {
  const asAt = d || new Date().toISOString().slice(0, 10);
  if (i.status === "draft") return false;
  if (i.acceptedOn && i.acceptedOn > asAt) return false;
  if (!i.acceptedOn && i.status !== "issued") return false;
  if (i.issuedOn && i.issuedOn > asAt) return false;
  if (i.withdrawnOn && i.withdrawnOn <= asAt) return false;
  return true;
}

export function liveInstruments(instruments: MandateInstrument[], d?: string): MandateInstrument[] {
  return instruments.filter((i) => instrumentLive(i, d));
}

export type MandateDecision = {
  id: string;
  orgId: string;
  entryId: string | null;
  decidedOn: string | null;
  takenById: string | null;
  summary: string;
  note: string | null;
  amount: number | null;
  category: string | null;
  reportedOn: string | null;
};

export type MandateBylawPack = {
  id: string;
  name: string;
  bylawTitle: string;
};

export type MandateBylawPackEntry = {
  id: string;
  packId: string;
  ref: string | null;
  schedule: string | null;
  band: string | null;
  provision: string | null;
  legislation: string | null;
  description: string;
  delegatingAuthority: string[];
  delegatingNote: string | null;
  status: string;
  delegatedBody: string[];
  delegatedBodyNote: string | null;
  delegate: string[];
  delegateNote: string | null;
  subDelegate: string[];
  subDelegateNote: string | null;
  subDelegateNone: boolean;
  furtherSubDelegate: string[];
  furtherSubNote: string | null;
  conditions: string | null;
  reportingCategory: string | null;
};

export type AuthorityOption = { v: string; l: string };

/** "R 1,234.00" - ported from app.js's money(). */
export function mandateMoney(n: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n);
}

/** Bodies before posts, then alphabetical; "(short — )name · department · vacant". Ported from views.js's authOptions(). */
export function authorityOptions(authorities: MandateAuthority[], kinds?: string[] | null): AuthorityOption[] {
  const list = (kinds ? authorities.filter((a) => kinds.includes(a.kind)) : authorities).slice();
  list.sort((a, b) => {
    const ak = a.kind === "body" ? 0 : 1;
    const bk = b.kind === "body" ? 0 : 1;
    if (ak !== bk) return ak - bk;
    return a.name.localeCompare(b.name);
  });
  return list.map((a) => ({
    v: a.id,
    l: (a.short ? `${a.short} — ` : "") + a.name + (a.department ? ` · ${a.department}` : "") + (a.vacant ? " · vacant" : ""),
  }));
}
