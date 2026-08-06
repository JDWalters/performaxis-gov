"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const RATING_COLUMN: Record<string, "self_rating" | "mgr_rating" | "panel_rating"> = {
  self: "self_rating",
  mgr: "mgr_rating",
  panel: "panel_rating",
};

/**
 * Sets one KPI's self/manager/panel rating for a quarter. Upserts against
 * appraisal_ratings(appraisal_kpi_id, quarter) touching only the one rating
 * column named by `view` - the same "only the listed columns are written on
 * conflict" upsert behaviour already relied on in appraisals/actions.ts, so
 * this never disturbs the actual/inputs/target/evidence/comment already
 * captured on that row (or the other two rating columns).
 */
export async function saveKpiRating(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const kpiId = str(formData, "kpiId");
  const quarter = Number(str(formData, "quarter"));
  const view = str(formData, "view");
  const ratingRaw = str(formData, "rating");
  const column = RATING_COLUMN[view];
  if (!kpiId || !quarter || !column) throw new Error("Missing KPI, quarter, or rating view.");

  const rating = ratingRaw ? Number(ratingRaw) : null;

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_kpi_id: kpiId, quarter, [column]: rating }], {
    onConflict: "appraisal_kpi_id,quarter",
  });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Toggles a KPI's N/A flag for a quarter - manager-only in the UI, drops the KPI out of the applicable pool entirely (see kpiWeights()/weightedScore()). */
export async function saveKpiNa(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const kpiId = str(formData, "kpiId");
  const quarter = Number(str(formData, "quarter"));
  const na = str(formData, "na") === "true";
  if (!kpiId || !quarter) throw new Error("Missing KPI or quarter.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_kpi_id: kpiId, quarter, na }], { onConflict: "appraisal_kpi_id,quarter" });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Sets one competency's self/manager/panel rating for a quarter - upserts against the (cycle, competency, quarter) unique key. */
export async function saveCompetencyRating(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const competencyId = str(formData, "competencyId");
  const quarter = Number(str(formData, "quarter"));
  const view = str(formData, "view");
  const ratingRaw = str(formData, "rating");
  const column = RATING_COLUMN[view];
  if (!cycleId || !competencyId || !quarter || !column) {
    throw new Error("Missing cycle, competency, quarter, or rating view.");
  }

  const rating = ratingRaw ? Number(ratingRaw) : null;

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_competency_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_cycle_id: cycleId, competency_id: competencyId, quarter, [column]: rating }], {
    onConflict: "appraisal_cycle_id,competency_id,quarter",
  });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Sets one KPI's assessment comment for a quarter - the same appraisal_ratings row the Capture Results tab's comment field writes to, so both screens show one shared note rather than two divergent ones. */
export async function saveKpiComment(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const kpiId = str(formData, "kpiId");
  const quarter = Number(str(formData, "quarter"));
  const comment = str(formData, "comment");
  if (!kpiId || !quarter) throw new Error("Missing KPI or quarter.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_kpi_id: kpiId, quarter, comment: comment || null }], {
    onConflict: "appraisal_kpi_id,quarter",
  });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

/** Sets one competency's comment for a quarter. */
export async function saveCompetencyComment(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const competencyId = str(formData, "competencyId");
  const quarter = Number(str(formData, "quarter"));
  const comment = str(formData, "comment");
  if (!cycleId || !competencyId || !quarter) throw new Error("Missing cycle, competency, or quarter.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_competency_ratings") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_cycle_id: cycleId, competency_id: competencyId, quarter, comment: comment || null }], {
    onConflict: "appraisal_cycle_id,competency_id,quarter",
  });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}

const META_FIELDS: Record<string, string> = {
  assessmentDate: "assessment_date",
  assessmentType: "assessment_type",
  panelMembers: "panel_members",
  employerComments: "employer_comments",
  employeeComments: "employee_comments",
  employeeSignature: "employee_signature",
  chairSignature: "chair_signature",
};

/** Updates one field of the quarter's assessment record (date/type/panel members/comments/signatures) - upserts against the (cycle, quarter) unique key, touching only the named field. */
export async function saveAssessmentMetaField(formData: FormData) {
  const cycleId = str(formData, "cycleId");
  const quarter = Number(str(formData, "quarter"));
  const field = str(formData, "field");
  const value = str(formData, "value");
  const column = META_FIELDS[field];
  if (!cycleId || !quarter || !column) throw new Error("Invalid field.");

  const supabase = await createClient();
  const { error } = await (
    supabase.from("appraisal_assessment_meta") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert([{ appraisal_cycle_id: cycleId, quarter, [column]: value || null }], {
    onConflict: "appraisal_cycle_id,quarter",
  });
  if (error) throw error;

  revalidatePath(`/appraisals/${cycleId}`);
}
