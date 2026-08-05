/**
 * Types and pure helpers shared between the server data layer (orgs.ts) and
 * client components (e.g. CreateOrgForm.tsx). Deliberately has no imports
 * from @/lib/supabase/server - that module pulls in next/headers, which
 * breaks the build the moment a client component imports it transitively
 * (same reason scorecards-shared.ts exists).
 */
import type { Tables } from "@/lib/supabase/types";

export type OrgKind = Tables<"orgs">["kind"];

export const KIND_LABEL: Record<OrgKind, string> = {
  national: "National",
  provincial: "Province",
  district: "District",
  municipality: "Municipality",
  department: "Department",
};

/** Kinds a user is allowed to create through the UI - "national" is a fixed singleton seeded once, never user-created. */
export const CREATABLE_KINDS: OrgKind[] = ["provincial", "district", "municipality", "department"];

export type OrgNode = {
  id: string;
  name: string;
  kind: OrgKind;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  isMetro: boolean;
  path: string;
  children: OrgNode[];
};

export type OrgOption = { id: string; name: string; kind: OrgKind; code: string | null; path: string };

export function isMetroOf(o: Tables<"orgs">): boolean {
  const meta = o.metadata as Record<string, unknown> | null;
  return Boolean(meta && typeof meta === "object" && meta.is_metro);
}

/**
 * Which kind of parent a new org of `kind` needs, mirroring the
 * `valid_org_parent_kind` DB trigger exactly:
 *   - provincial   -> parent must be national
 *   - district     -> parent must be provincial
 *   - municipality -> parent must be district, or provincial directly if it's a metro
 *   - department   -> parent must be municipality
 * Shared by the server-side picker (getValidParentOrgs) and the client form
 * (CreateOrgForm) so both filter identically.
 */
export function parentKindFor(kind: OrgKind, isMetro: boolean): OrgKind {
  if (kind === "provincial") return "national";
  if (kind === "district") return "provincial";
  if (kind === "municipality") return isMetro ? "provincial" : "district";
  return "municipality";
}
