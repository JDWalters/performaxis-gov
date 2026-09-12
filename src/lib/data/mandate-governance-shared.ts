/**
 * Mandate governance workspace - types and pure helpers, ported from
 * assets/governance.js's amendment workflow (propose/submit/review/decide).
 * No @/lib/supabase/server import here, matching the mandate-shared.ts
 * split, so client components (the propose/review modals) can use these
 * directly.
 */
import type { MandateEntry, AuthorityMap } from "@/lib/data/mandate-shared";

/** The subset of an entry's fields an amendment can touch. Ported from governance.js's FIELDS/snapshot(). */
export type EntrySnapshot = {
  delegatedBodyIds: string[];
  delegatedBodyNote: string;
  delegateIds: string[];
  delegateNote: string;
  subDelegateIds: string[];
  subDelegateNote: string;
  furtherSubDelegateIds: string[];
  furtherSubDelegateNote: string;
  conditions: string;
  reviewStatus: string;
  status: string; // 'delegated' | 'reserved'
  establishmentNote: string;
};

export const CHAIN_FIELDS: { k: keyof EntrySnapshot; n: keyof EntrySnapshot; l: string }[] = [
  { k: "delegatedBodyIds", n: "delegatedBodyNote", l: "Delegated body" },
  { k: "delegateIds", n: "delegateNote", l: "Delegated to" },
  { k: "subDelegateIds", n: "subDelegateNote", l: "Sub-delegated to" },
  { k: "furtherSubDelegateIds", n: "furtherSubDelegateNote", l: "Further sub-delegated to" },
];

const OTHER_LABELS: Record<string, string> = {
  conditions: "Conditions",
  reviewStatus: "Legal review status",
  status: "Reserved to Council",
  establishmentNote: "Establishment note",
};

export function fieldLabel(k: string): string {
  const f = CHAIN_FIELDS.find((x) => x.k === k);
  if (f) return f.l;
  return OTHER_LABELS[k] || k;
}

/** Ported from governance.js's snapshot(). */
export function snapshot(e: MandateEntry): EntrySnapshot {
  return {
    delegatedBodyIds: e.delegatedBodyIds.slice(),
    delegatedBodyNote: e.delegatedBodyNote || "",
    delegateIds: e.delegateIds.slice(),
    delegateNote: e.delegateNote || "",
    subDelegateIds: e.subDelegateIds.slice(),
    subDelegateNote: e.subDelegateNote || "",
    furtherSubDelegateIds: e.furtherSubDelegateIds.slice(),
    furtherSubDelegateNote: e.furtherSubDelegateNote || "",
    conditions: e.conditions || "",
    reviewStatus: e.reviewStatus || "",
    status: e.status || "delegated",
    establishmentNote: e.establishmentNote || "",
  };
}

const DIFFABLE_KEYS: (keyof EntrySnapshot)[] = [
  "delegatedBodyIds",
  "delegatedBodyNote",
  "delegateIds",
  "delegateNote",
  "subDelegateIds",
  "subDelegateNote",
  "furtherSubDelegateIds",
  "furtherSubDelegateNote",
  "conditions",
  "reviewStatus",
  "status",
  "establishmentNote",
];

/** Which top-level fields actually changed between two snapshots. Ported from governance.js's diff(). */
export function diffFields(before: EntrySnapshot, after: EntrySnapshot): string[] {
  const out: string[] = [];
  for (const k of DIFFABLE_KEYS) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.push(k);
  }
  return out;
}

export type ChangeStatus = "draft" | "submitted" | "approved" | "rejected" | "withdrawn";

export type MandateChangeRequest = {
  id: string;
  orgId: string;
  entryId: string | null;
  ref: string;
  fields: string[];
  before: EntrySnapshot | null;
  after: EntrySnapshot | null;
  reason: string;
  status: ChangeStatus;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedByName: string;
  decidedAt: string | null;
};

export type MandateVersion = {
  id: string;
  orgId: string;
  no: number;
  label: string;
  approvedBy: string | null;
  approvedByName: string;
  approvedAt: string;
  changeIds: string[];
};

export type MandateWorkflowEvent = {
  id: string;
  orgId: string;
  at: string;
  who: string | null;
  whoName: string;
  role: string | null;
  action: string;
  detail: string;
  changeId: string | null;
};

export function statusLabel(s: ChangeStatus): string {
  return (
    { draft: "Draft", submitted: "Awaiting decision", approved: "Approved", rejected: "Returned", withdrawn: "Withdrawn" }[s] ||
    s
  );
}

export function statusTone(s: ChangeStatus): "reserved" | "action" | "aligned" {
  return (
    ({ draft: "reserved", submitted: "action", approved: "aligned", rejected: "action", withdrawn: "reserved" } as const)[s] ||
    "reserved"
  );
}

/** "Delegated to: CFO (FIN-01); Director (CS-01)" style summary of one field in a snapshot, for the review diff table. Ported from governance.js's show(). */
export function showField(k: string, snap: EntrySnapshot, authorities: AuthorityMap): string {
  const f = CHAIN_FIELDS.find((x) => x.k === k);
  if (f) {
    const ids = snap[f.k] as string[];
    const names = ids.map((id) => {
      const a = authorities.get(id);
      return a ? a.short || a.name : id;
    });
    const note = snap[f.n] as string;
    return [note, names.join("; ")].filter(Boolean).join(" — ") || "None";
  }
  if (k === "status") return snap.status === "reserved" ? "Reserved to Council" : "Delegated";
  return (snap as unknown as Record<string, string>)[k] || "None";
}
