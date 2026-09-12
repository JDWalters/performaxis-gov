/**
 * Mandate governance workspace - server-side data fetching. Types and pure
 * helpers live in mandate-governance-shared.ts (see that file's header for
 * why). Display names for created_by/decided_by/who (all auth user uuids)
 * are resolved the same way getOrgMembers() does in users.ts - via the
 * service-role admin client, since profiles is self-select-only and emails
 * live in auth.users, which PostgREST doesn't expose.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntrySnapshot, MandateChangeRequest, MandateVersion, MandateWorkflowEvent } from "@/lib/data/mandate-governance-shared";

export type {
  EntrySnapshot,
  ChangeStatus,
  MandateChangeRequest,
  MandateVersion,
  MandateWorkflowEvent,
} from "@/lib/data/mandate-governance-shared";
export { CHAIN_FIELDS, fieldLabel, snapshot, diffFields, statusLabel, statusTone, showField } from "@/lib/data/mandate-governance-shared";

async function nameMap(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = new Set(ids.filter((x): x is string => !!x));
  const out = new Map<string, string>();
  if (wanted.size === 0) return out;
  try {
    const admin = createAdminClient();
    const [{ data: usersData }, { data: profilesData }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("id, full_name"),
    ]);
    const emailById = new Map<string, string>();
    for (const u of usersData?.users ?? []) if (u.id && u.email) emailById.set(u.id, u.email);
    for (const p of (profilesData ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) out.set(p.id, p.full_name);
    }
    for (const id of wanted) if (!out.has(id) && emailById.has(id)) out.set(id, emailById.get(id)!);
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured - names just fall back to "Unknown".
  }
  return out;
}

type ChangeRow = {
  id: string;
  org_id: string;
  entry_id: string | null;
  ref: string | null;
  fields: string[];
  before_row: EntrySnapshot | null;
  after_row: EntrySnapshot | null;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
};

export async function getMandateChanges(orgId: string): Promise<MandateChangeRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_change_requests")
    .select("id, org_id, entry_id, ref, fields, before_row, after_row, reason, status, created_by, created_at, submitted_at, decided_by, decided_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ChangeRow[];
  const names = await nameMap(rows.flatMap((r) => [r.created_by, r.decided_by]));
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    entryId: r.entry_id,
    ref: r.ref || r.id.slice(-6),
    fields: r.fields ?? [],
    before: r.before_row,
    after: r.after_row,
    reason: r.reason || "",
    status: r.status as MandateChangeRequest["status"],
    createdBy: r.created_by,
    createdByName: (r.created_by && names.get(r.created_by)) || "Unknown",
    createdAt: r.created_at,
    submittedAt: r.submitted_at,
    decidedBy: r.decided_by,
    decidedByName: (r.decided_by && names.get(r.decided_by)) || "",
    decidedAt: r.decided_at,
  }));
}

type VersionRow = {
  id: string;
  org_id: string;
  no: number;
  label: string | null;
  approved_by: string | null;
  approved_at: string;
  change_ids: string[];
};

export async function getMandateVersions(orgId: string): Promise<MandateVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_register_versions")
    .select("id, org_id, no, label, approved_by, approved_at, change_ids")
    .eq("org_id", orgId)
    .order("no", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as VersionRow[];
  const names = await nameMap(rows.map((r) => r.approved_by));
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    no: r.no,
    label: r.label || "",
    approvedBy: r.approved_by,
    approvedByName: (r.approved_by && names.get(r.approved_by)) || "Unknown",
    approvedAt: r.approved_at,
    changeIds: r.change_ids ?? [],
  }));
}

type EventRow = {
  id: string;
  org_id: string;
  at: string;
  who: string | null;
  role: string | null;
  action: string;
  detail: string | null;
  change_id: string | null;
};

export async function getMandateWorkflowEvents(orgId: string, limit = 50): Promise<MandateWorkflowEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mandate_workflow_events")
    .select("id, org_id, at, who, role, action, detail, change_id")
    .eq("org_id", orgId)
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as EventRow[];
  const names = await nameMap(rows.map((r) => r.who));
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    at: r.at,
    who: r.who,
    whoName: (r.who && names.get(r.who)) || "Unknown",
    role: r.role,
    action: r.action,
    detail: r.detail || "",
    changeId: r.change_id,
  }));
}
