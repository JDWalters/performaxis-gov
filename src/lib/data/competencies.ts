import { createClient } from "@/lib/supabase/server";

export type CompetencyGroup = "Core" | "Leading";

export type CompetencyRow = {
  id: string;
  name: string;
  groupName: CompetencyGroup | null;
  drivingText: string | null;
};

/** The competency framework for one municipality (competencies.org_id) - regulatory in nature but stored per-org so a municipality can tailor "driving competencies" notes. */
export async function getCompetencies(municipalityOrgId: string): Promise<CompetencyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competencies")
    .select("id, name, group_name, driving_text")
    .eq("org_id", municipalityOrgId)
    .order("group_name")
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as unknown as { id: string; name: string; group_name: string | null; driving_text: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    groupName: (r.group_name as CompetencyGroup | null) ?? null,
    drivingText: r.driving_text,
  }));
}

/**
 * The 12 competencies prescribed by the Local Government: Regulations on
 * the Appointment and Conditions of Employment of Senior Managers (17
 * January 2014) - used to seed a new municipality's framework, and offered
 * as a one-click "restore" if someone edits it away from the prescribed
 * set, matching the reference tool's "Restore the 12 prescribed
 * competencies" button.
 */
export const PRESCRIBED_COMPETENCIES: { name: string; groupName: CompetencyGroup }[] = [
  { name: "Strategic direction and leadership", groupName: "Leading" },
  { name: "People management", groupName: "Leading" },
  { name: "Programme and project management", groupName: "Leading" },
  { name: "Financial management", groupName: "Leading" },
  { name: "Change leadership", groupName: "Leading" },
  { name: "Governance leadership", groupName: "Leading" },
  { name: "Moral competence", groupName: "Core" },
  { name: "Planning and organising", groupName: "Core" },
  { name: "Analysis and innovation", groupName: "Core" },
  { name: "Knowledge and information management", groupName: "Core" },
  { name: "Communication", groupName: "Core" },
  { name: "Results and quality focus", groupName: "Core" },
];
