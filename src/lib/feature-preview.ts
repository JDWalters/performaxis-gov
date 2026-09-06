/**
 * Gate for work-in-progress features that should only be visible to one
 * person while they're being tried out, with a single flip to open them up
 * to everyone once they're ready - no code change or redeploy needed for
 * the flip itself, just an env var change in Vercel (still needs a
 * redeploy to take effect, since env vars are read at server start, but
 * that's a one-click "Redeploy" in the Vercel dashboard, not a code edit).
 *
 * FEATURE_PREVIEW_EMAIL defaults to the account that's been used as admin
 * throughout this project. FEATURE_PREVIEW_ONLY defaults to "on" (true) -
 * set it to the literal string "false" in Vercel's env vars to make every
 * preview-gated feature visible to everyone.
 */
const PREVIEW_EMAIL = process.env.FEATURE_PREVIEW_EMAIL ?? "jacques@website.co.za";
const PREVIEW_ONLY = process.env.FEATURE_PREVIEW_ONLY !== "false";

export function canPreviewNewFeatures(email: string | null | undefined): boolean {
  if (!PREVIEW_ONLY) return true;
  return !!email && email.toLowerCase() === PREVIEW_EMAIL.toLowerCase();
}
