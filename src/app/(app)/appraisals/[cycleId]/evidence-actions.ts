"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "kpi-evidence";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour - regenerated fresh on every page load.

// Re-throws any Supabase/postgrest error as a plain Error carrying just its
// message - see the identical helper (and its rationale) in users/actions.ts.
function fail(err: { message?: string } | null | undefined): never {
  throw new Error(err?.message || "Something went wrong.");
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export type EvidenceFile = {
  id: string;
  fileName: string;
  fileSize: number | null;
  contentType: string | null;
  url: string | null;
  createdAt: string;
};

/**
 * Generates fresh 1-hour signed URLs for a batch of evidence files, keyed by
 * their storage path. Same helper/bucket as the SDBIP side (evidence-actions.ts
 * under scorecards/[id]) - both KPI kinds share one private bucket, just
 * different path prefixes ("sdbip/" vs "epas/").
 */
export async function signEvidencePaths(paths: string[]): Promise<Record<string, string | null>> {
  if (paths.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return Object.fromEntries(paths.map((p) => [p, null]));
  return Object.fromEntries(data.map((d) => [d.path ?? "", d.signedUrl ?? null]));
}

/**
 * Uploads one or more evidence files for an appraisal KPI's quarter. See the
 * SDBIP-side uploadKpiEvidence() for the full rationale on why the storage
 * bytes go through the service-role admin client while the DB row goes
 * through the session client (RLS is the real gatekeeper).
 */
export async function uploadAppraisalEvidence(formData: FormData) {
  const cycleId = String(formData.get("cycleId") ?? "");
  const appraisalKpiId = String(formData.get("appraisalKpiId") ?? "");
  const quarter = Number(formData.get("quarter"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!appraisalKpiId || !quarter) throw new Error("Missing appraisal KPI or quarter.");
  if (files.length === 0) return;

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const file of files) {
    const path = `epas/${appraisalKpiId}/${quarter}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadErr) fail(uploadErr);

    // Cast: same pragmatic workaround as the upsert cast in appraisals/actions.ts.
    const { error: insertErr } = await (
      supabase.from("appraisal_evidence_files") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert({
      appraisal_kpi_id: appraisalKpiId,
      quarter,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || null,
      uploaded_by: user?.id ?? null,
    });
    if (insertErr) {
      await admin.storage.from(BUCKET).remove([path]);
      fail(insertErr);
    }
  }

  if (cycleId) revalidatePath(`/appraisals/${cycleId}`);
}

/**
 * Deletes one evidence file. See uploadKpiEvidence's sibling on the SDBIP
 * side for why `.delete().select()` is required (RLS silently deletes zero
 * rows rather than erroring, so the returned row count is the only way to
 * tell an authorised no-op apart from a denied delete).
 */
export async function deleteAppraisalEvidence(fileId: string, cycleId: string) {
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("appraisal_evidence_files")
    .delete()
    .eq("id", fileId)
    .select("file_path");
  if (error) fail(error);
  if (!deleted || deleted.length === 0) {
    throw new Error("Couldn't delete that file - you may not have permission, or it's already gone.");
  }

  const path = (deleted[0] as unknown as { file_path: string }).file_path;
  if (path) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([path]);
  }

  if (cycleId) revalidatePath(`/appraisals/${cycleId}`);
}
