/**
 * Types and constants shared between the server data layer (pdp.ts) and
 * client components (PdpEditor.tsx). No @/lib/supabase/server import here -
 * same reason as employees-shared.ts/orgs-shared.ts: a "use client" import of
 * a server-only module (even just for a constant) breaks the build.
 */

export const PDP_MODES = [
  "Self-study",
  "Internal training",
  "External training",
  "Coaching",
  "Mentoring",
  "Exchange programme",
  "On-the-job",
  "Formal qualification",
] as const;

export const PDP_STATUSES = ["Planned", "In progress", "Completed", "Deferred"] as const;

export type PdpItem = {
  id: string;
  priority: string | null;
  gap: string | null;
  outcome: string | null;
  activity: string | null;
  mode: string | null;
  timeframe: string | null;
  opportunity: string | null;
  supportPerson: string | null;
  days: number | null;
  status: string;
};
