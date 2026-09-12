/**
 * Mandate - server-side data fetching. Types and pure helpers live in
 * mandate-shared.ts (no @/lib/supabase/server import there, so client
 * components can use them too) - this file re-exports them for callers that
 * only need one import.
 */
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import type {
  MandateOrg,
  MandateAuthority,
  MandateEntry,
  MandateInstrument,
  MandateDecision,
  MandateBylawPack,
  MandateBylawPackEntry,
} from "@/lib/data/mandate-shared";

export type {
  MandateOrg,
  MandateAuthority,
  MandateEntry,
  MandateInstrument,
  MandateDecision,
  MandateBylawPack,
  MandateBylawPackEntry,
  MandateFlag,
  AuthorityOption,
  AuthorityMap,
  Alignment,
} from "@/lib/data/mandate-shared";
export {
  authorityMap,
  delegatesOf,
  alignment,
  alignmentReason,
  legislationOf,
  legLabel,
  postCodes,
  departmentsOf,
  nameList,
  authorityLabel,
  delegatedToLabel,
  vacantHolder,
  flagsFor,
  instrumentLive,
  liveInstruments,
  authorityOptions,
  mandateMoney,
  ALIGN_LABEL,
} from "@/lib/data/mandate-shared";

type OrgRow = Pick<Tables<"orgs">, "id" | "name" | "code" | "kind" | "metadata">;

function toMandateOrg(row: OrgRow): MandateOrg {
  const meta = (row.metadata as Record<string, unknown> | null)?.mandate as
    | {
        instrumentTitle?: string;
        version?: string;
        governingBody?: string;
        schedules?: { tab: string; code: string; title: string }[];
        categories?: { id: string; label: string }[];
      }
    | undefined;
  return {
    id: row.id,
    name: row.name,
    shortName: row.code ?? row.name,
    kind: row.kind,
    instrumentTitle: meta?.instrumentTitle ?? "Delegation of Powers and Authority",
    version: meta?.version ?? "1",
    governingBody: meta?.governingBody ?? "Governing body",
    schedules: meta?.schedules ?? [],
    categories: meta?.categories ?? [],
  };
}

/** Every org the signed-in user can view Mandate for (municipality or water_board kind - RLS on mandate_* tables enforces the view_mandate permission; this just narrows the org picker to relevant kinds). */
export async function getMandateOrgs(): Promise<MandateOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, name, code, kind, metadata")
    // "water_board" is a real org_kind value in the DB (added for Mandate's
    // Sand-Vet Water Users Association), but the generated Tables<"orgs">
    // type predates it, so the enum union here is stale - cast around it
    // rather than regenerating types.ts wholesale (the same "cast, don't
    // regenerate" pattern already used throughout this codebase for new
    // tables like appraisal_kpi_library).
    .in("kind", ["municipality", "water_board"] as unknown as OrgRow["kind"][])
    .order("name");
  if (error) throw error;
  return ((data ?? []) as OrgRow[]).map(toMandateOrg);
}

export async function getMandateOrg(orgId: string): Promise<MandateOrg | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select("id, name, code, kind, metadata")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? toMandateOrg(data as OrgRow) : null;
}

type AuthorityRow = {
  id: string;
  org_id: string;
  kind: string;
  name: string;
  short_label: string | null;
  incumbent: string | null;
  department: string | null;
  je_level: string | null;
  vacant: boolean;
  note: string | null;
};

export async function getMandateAuthorities(orgId: string): Promise<MandateAuthority[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_authorities")
    .select("id, org_id, kind, name, short_label, incumbent, department, je_level, vacant, note")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as AuthorityRow[]).map((a) => ({
    id: a.id,
    orgId: a.org_id,
    kind: a.kind,
    name: a.name,
    short: a.short_label,
    incumbent: a.incumbent,
    department: a.department,
    jeLevel: a.je_level,
    vacant: a.vacant,
    note: a.note,
  }));
}

type EntryRow = {
  id: string;
  org_id: string;
  ref: string;
  schedule: string | null;
  band: string | null;
  provision: string | null;
  legislation: string | null;
  source_legislation: string | null;
  description: string;
  delegating_authority: string[] | null;
  delegating_note: string | null;
  status: string;
  delegated_body: string[] | null;
  delegated_body_note: string | null;
  delegate: string[] | null;
  delegate_note: string | null;
  sub_delegate: string[] | null;
  sub_delegate_note: string | null;
  sub_delegate_none: boolean;
  further_sub_delegate: string[] | null;
  further_sub_note: string | null;
  conditions: string | null;
  reporting_category: string | null;
  threshold_linked: boolean;
  paja_linked: boolean;
  review_status: string | null;
  review_note: string | null;
  establishment_note: string | null;
  source_ref: string | null;
  instrument_type: string | null;
  instrument_confirm: boolean;
};

function toMandateEntry(r: EntryRow): MandateEntry {
  return {
    id: r.id,
    orgId: r.org_id,
    ref: r.ref,
    schedule: r.schedule,
    band: r.band,
    provision: r.provision,
    legislation: r.legislation,
    sourceLegislation: r.source_legislation,
    description: r.description,
    delegatingAuthorityIds: r.delegating_authority ?? [],
    delegatingAuthorityNote: r.delegating_note,
    status: r.status,
    delegatedBodyIds: r.delegated_body ?? [],
    delegatedBodyNote: r.delegated_body_note,
    delegateIds: r.delegate ?? [],
    delegateNote: r.delegate_note,
    subDelegateIds: r.sub_delegate ?? [],
    subDelegateNote: r.sub_delegate_note,
    subDelegateNone: r.sub_delegate_none,
    furtherSubDelegateIds: r.further_sub_delegate ?? [],
    furtherSubDelegateNote: r.further_sub_note,
    conditions: r.conditions,
    reportingCategory: r.reporting_category,
    thresholdLinked: r.threshold_linked,
    pajaLinked: r.paja_linked,
    reviewStatus: r.review_status,
    reviewNote: r.review_note,
    establishmentNote: r.establishment_note,
    sourceRef: r.source_ref,
    instrumentType: r.instrument_type,
    instrumentToConfirm: r.instrument_confirm,
  };
}

export async function getMandateEntries(orgId: string): Promise<MandateEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_entries")
    .select(
      "id, org_id, ref, schedule, band, provision, legislation, source_legislation, description, delegating_authority, delegating_note, status, delegated_body, delegated_body_note, delegate, delegate_note, sub_delegate, sub_delegate_note, sub_delegate_none, further_sub_delegate, further_sub_note, conditions, reporting_category, threshold_linked, paja_linked, review_status, review_note, establishment_note, source_ref, instrument_type, instrument_confirm"
    )
    .eq("org_id", orgId)
    .order("ref");
  if (error) throw error;
  return ((data ?? []) as unknown as EntryRow[]).map(toMandateEntry);
}

type InstrumentRow = {
  id: string;
  org_id: string;
  entry_id: string;
  from_post: string | null;
  to_post: string | null;
  conditions: string | null;
  issued_on: string | null;
  accepted_on: string | null;
  withdrawn_on: string | null;
  status: string;
};

export async function getMandateInstruments(orgId: string): Promise<MandateInstrument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_instruments")
    .select("id, org_id, entry_id, from_post, to_post, conditions, issued_on, accepted_on, withdrawn_on, status")
    .eq("org_id", orgId);
  if (error) throw error;
  return ((data ?? []) as unknown as InstrumentRow[]).map((i) => ({
    id: i.id,
    orgId: i.org_id,
    entryId: i.entry_id,
    fromPostId: i.from_post,
    toPostId: i.to_post,
    conditions: i.conditions,
    issuedOn: i.issued_on,
    acceptedOn: i.accepted_on,
    withdrawnOn: i.withdrawn_on,
    status: i.status,
  }));
}

type DecisionRow = {
  id: string;
  org_id: string;
  entry_id: string | null;
  decided_on: string | null;
  taken_by: string | null;
  summary: string;
  note: string | null;
  amount: number | null;
  category: string | null;
  reported_on: string | null;
};

export async function getMandateDecisions(orgId: string): Promise<MandateDecision[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_decisions")
    .select("id, org_id, entry_id, decided_on, taken_by, summary, note, amount, category, reported_on")
    .eq("org_id", orgId)
    .order("decided_on", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as DecisionRow[]).map((d) => ({
    id: d.id,
    orgId: d.org_id,
    entryId: d.entry_id,
    decidedOn: d.decided_on,
    takenById: d.taken_by,
    summary: d.summary,
    note: d.note,
    amount: d.amount,
    category: d.category,
    reportedOn: d.reported_on,
  }));
}

type BylawPackRow = { id: string; name: string; bylaw_title: string };

export async function getMandateBylawPacks(): Promise<MandateBylawPack[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mandate_bylaw_packs").select("id, name, bylaw_title").order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as BylawPackRow[]).map((p) => ({ id: p.id, name: p.name, bylawTitle: p.bylaw_title }));
}

type BylawPackEntryRow = {
  id: string;
  pack_id: string;
  ref: string | null;
  schedule: string | null;
  band: string | null;
  provision: string | null;
  legislation: string | null;
  description: string;
  delegating_authority: string[] | null;
  delegating_note: string | null;
  status: string;
  delegated_body: string[] | null;
  delegated_body_note: string | null;
  delegate: string[] | null;
  delegate_note: string | null;
  sub_delegate: string[] | null;
  sub_delegate_note: string | null;
  sub_delegate_none: boolean;
  further_sub_delegate: string[] | null;
  further_sub_note: string | null;
  conditions: string | null;
  reporting_category: string | null;
};

export async function getMandateBylawPackEntries(packId: string): Promise<MandateBylawPackEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_bylaw_entries")
    .select(
      "id, pack_id, ref, schedule, band, provision, legislation, description, delegating_authority, delegating_note, status, delegated_body, delegated_body_note, delegate, delegate_note, sub_delegate, sub_delegate_note, sub_delegate_none, further_sub_delegate, further_sub_note, conditions, reporting_category"
    )
    .eq("pack_id", packId)
    .order("ref");
  if (error) throw error;
  return ((data ?? []) as unknown as BylawPackEntryRow[]).map((r) => ({
    id: r.id,
    packId: r.pack_id,
    ref: r.ref,
    schedule: r.schedule,
    band: r.band,
    provision: r.provision,
    legislation: r.legislation,
    description: r.description,
    delegatingAuthority: r.delegating_authority ?? [],
    delegatingNote: r.delegating_note,
    status: r.status,
    delegatedBody: r.delegated_body ?? [],
    delegatedBodyNote: r.delegated_body_note,
    delegate: r.delegate ?? [],
    delegateNote: r.delegate_note,
    subDelegate: r.sub_delegate ?? [],
    subDelegateNote: r.sub_delegate_note,
    subDelegateNone: r.sub_delegate_none,
    furtherSubDelegate: r.further_sub_delegate ?? [],
    furtherSubNote: r.further_sub_note,
    conditions: r.conditions,
    reportingCategory: r.reporting_category,
  }));
}

/** How many of an org's current entries came from each by-law pack (pack_id set at "adopt" time) - drives the library screen's "Adopted (n)" / "Add to register" vs "Remove" toggle. */
export async function getBylawAdoptedCounts(orgId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mandate_entries").select("pack_id").eq("org_id", orgId).not("pack_id", "is", null);
  if (error) throw error;
  const out = new Map<string, number>();
  for (const row of (data ?? []) as unknown as { pack_id: string }[]) {
    out.set(row.pack_id, (out.get(row.pack_id) ?? 0) + 1);
  }
  return out;
}

/** has_org_access() for a Mandate permission - shared by the page (gating "+ Add a delegation") and any future server actions. */
export async function hasMandatePermission(orgId: string, permission: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>
  )("has_org_access", { target_org_id: orgId, required_permission: permission });
  if (error) throw error;
  return !!data;
}
