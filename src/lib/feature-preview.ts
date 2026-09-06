/**
 * Gate for work-in-progress features that should only be visible to one
 * person while they're being tried out, with a single flip to open them up
 * to everyone once they're ready - no code change or redeploy needed for
 * the flip itself, just an env var change in Vercel (still needs a
 * redeploy to take effect, since env vars are read at server start, but
 * that's a one-click "Redeploy" in the Vercel dashboard, not a code edit).
 *
 * Matches on the signed-in user's display name (profiles.full_name - the
 * "JD" shown in the header chip and the sidebar's account card), not their
 * email - email matching broke as soon as the real login email diverged
 * from this project's original placeholder admin address, so every gated
 * feature silently stopped appearing. FEATURE_PREVIEW_NAME defaults to
 * "JD"; FEATURE_PREVIEW_ONLY defaults to "on" (true) - set it to the
 * literal string "false" in Vercel's env vars to make every preview-gated
 * feature visible to everyone.
 */
const PREVIEW_NAME = process.env.FEATURE_PREVIEW_NAME ?? "JD";
const PREVIEW_ONLY = process.env.FEATURE_PREVIEW_ONLY !== "false";

export function canPreviewNewFeatures(displayName: string | null | undefined): boolean {
  if (!PREVIEW_ONLY) return true;
  return !!displayName && displayName.trim().toLowerCase() === PREVIEW_NAME.toLowerCase();
}
