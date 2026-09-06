"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "kpi-evidence";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour - regenerated fresh on every page load.

// Re-throws any Supabase/postgrest error as a plain Error carrying just its
// message - see the identical helper (and its rationale) in users/actions.ts.
// Server Actions that throw a raw PostgrestError risk failing RSC/Flight
// serialization on the way back to the client.
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
 * their storage path. Used from the data layer (scorecards.ts/appraisals.ts)
 * so every page load shows working download links without exposing the
 * private bucket publicly. Missing/expired-signing failures degrade to a
 * null url per file rather than failing the whole page.
 */
export async function signEvidencePaths(paths: string[]): Promise<Record<string, string | null>> {
  if (paths.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return Object.fromEntries(paths.map((p) => [p, null]));
  return Object.fromEntries(data.map((d) => [d.path ?? "", d.signedUrl ?? null]));
}

/**
 * Uploads one or more evidence files for a scorecard KPI's quarter. The
 * storage bucket is private with no object-level RLS (there's no clean way
 * to express has_org_access inside a storage policy), so the raw bytes go
 * through the service-role admin client - but the kpi_evidence_files DB row
 * still goes through the session client, so the same results_insert-style
 * RLS that gates everything else in this app is the real gatekeeper here too.
 * If the DB insert is rejected (unauthorized, or any other error) the
 * just-uploaded object is deleted again so nothing orphaned is left behind.
 */
export async function uploadKpiEvidence(formData: FormData) {
  const scorecardId = String(formData.get("scorecardId") ?? "");
  const scorecardKpiId = String(formData.get("scorecardKpiId") ?? "");
  const quarter = Number(formData.get("quarter"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!scorecardKpiId || !quarter) throw new Error("Missing scorecard KPI or quarter.");
  if (files.length === 0) return;

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const file of files) {
    const path = `sdbip/${scorecardKpiId}/${quarter}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadErr) fail(uploadErr);

    // Cast: same pragmatic workaround used for the upsert() call in
    // scorecards/actions.ts - insert()'s generic overload resolution doesn't
    // always hold up cleanly against the generated Row/Insert types.
    const { error: insertErr } = await (
      supabase.from("kpi_evidence_files") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert({
      scorecard_kpi_id: scorecardKpiId,
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

  if (scorecardId) revalidatePath(`/scorecards/${scorecardId}`);
}

/**
 * Deletes one evidence file. The DB delete goes through the session client
 * so RLS (kpi_evidence_files_delete) is what actually authorises this -
 * `.select()` chained onto `.delete()` is required to tell an authorised
 * delete-of-nothing apart from an RLS-denied delete, since Postgres RLS
 * silently deletes zero rows rather than erroring. The storage object delete
 * that follows is best-effort - an orphaned object left behind on a rare
 * failure just wastes a little storage, it's not a security concern once the
 * DB row (the thing every read path actually looks at) is gone.
 */
export async function deleteKpiEvidence(fileId: string, scorecardId: string) {
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("kpi_evidence_files")
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

  if (scorecardId) revalidatePath(`/scorecards/${scorecardId}`);
}
