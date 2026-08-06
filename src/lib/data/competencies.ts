import { createClient } from "@/lib/supabase/server";

export type CompetencyGroup = "Core" | "Leading";

export type CompetencyRow = {
  id: string;
  name: string;
  groupName: CompetencyGroup | null;
  drivingText: string | null;
};

/**
 * The regulation presents the twelve competencies in a fixed order - Leading
 * before Core, and within each group a specific sequence (Strategic
 * Direction and Leadership leads, not "Change leadership" first just
 * because C < S) - matching PRESCRIBED_COMPETENCIES below, not alphabetical.
 * Falls back to alphabetical for anything renamed away from a prescribed
 * name or genuinely custom-added.
 */
export function competencyRank(name: string, groupName: CompetencyGroup | null): [number, number] {
  const groupRank = groupName === "Leading" ? 0 : groupName === "Core" ? 1 : 2;
  const prescribedIndex = PRESCRIBED_COMPETENCIES.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
  return [groupRank, prescribedIndex === -1 ? 999 : prescribedIndex];
}

/** The competency framework for one municipality (competencies.org_id) - regulatory in nature but stored per-org so a municipality can tailor "driving competencies" notes. */
export async function getCompetencies(municipalityOrgId: string): Promise<CompetencyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competencies")
    .select("id, name, group_name, driving_text")
    .eq("org_id", municipalityOrgId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as { id: string; name: string; group_name: string | null; driving_text: string | null }[];
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      groupName: (r.group_name as CompetencyGroup | null) ?? null,
      drivingText: r.driving_text,
    }))
    .sort((a, b) => {
      const [ga, ra] = competencyRank(a.name, a.groupName);
      const [gb, rb] = competencyRank(b.name, b.groupName);
      if (ga !== gb) return ga - gb;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
}

/**
 * The 12 competencies prescribed by the Local Government: Regulations on
 * the Appointment and Conditions of Employment of Senior Managers (17
 * January 2014) - used to seed a new municipality's framework, and offered
 * as a one-click "restore" if someone edits it away from the prescribed
 * set, matching the reference tool's "Restore the 12 prescribed
 * competencies" button.
 */
export const PRESCRIBED_COMPETENCIES: { name: string; groupName: CompetencyGroup; drivingText: string | null }[] = [
  {
    name: "Strategic direction and leadership",
    groupName: "Leading",
    drivingText: "Impact and Influence; Institutional Performance Management; Strategic Planning and Management; Organisational Awareness",
  },
  {
    name: "People management",
    groupName: "Leading",
    drivingText: "Human Capital Planning and Development; Diversity Management; Employee Relations Management; Negotiation and Dispute Management",
  },
  {
    // "Program", not "Programme" - matches the Regulations' own spelling
    // (and the reference tool's LEADING array) exactly; an earlier pass in
    // this project guessed the British spelling was "correct" and got it
    // backwards.
    name: "Program and project management",
    groupName: "Leading",
    drivingText: "Program and Project Planning and Implementation; Service Delivery Management; Program and Project Monitoring and Evaluation",
  },
  {
    name: "Financial management",
    groupName: "Leading",
    drivingText: "Budget Planning and Execution; Financial Strategy and Delivery; Financial Reporting and Monitoring",
  },
  {
    name: "Change leadership",
    groupName: "Leading",
    drivingText: "Change Vision and Strategy; Process Design and Improvement; Change Impact Monitoring and Evaluation",
  },
  {
    name: "Governance leadership",
    groupName: "Leading",
    drivingText: "Policy Formulation; Risk and Compliance Management; Cooperative Governance",
  },
  { name: "Moral competence", groupName: "Core", drivingText: null },
  { name: "Planning and organising", groupName: "Core", drivingText: null },
  { name: "Analysis and innovation", groupName: "Core", drivingText: null },
  { name: "Knowledge and information management", groupName: "Core", drivingText: null },
  { name: "Communication", groupName: "Core", drivingText: null },
  { name: "Results and quality focus", groupName: "Core", drivingText: null },
];
