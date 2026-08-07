/**
 * Canonical deployed URL for building absolute links that have to resolve
 * correctly regardless of which environment triggered them - invite
 * emails, password-reset emails, anything passed to Supabase as a
 * `redirectTo`. Supabase only honors a `redirectTo` that matches an entry
 * in Authentication > URL Configuration > Redirect URLs; anything else
 * silently falls back to the dashboard's Site URL instead (this is what
 * originally sent invite links to localhost:3000).
 *
 * Falls back to the known production Vercel domain if NEXT_PUBLIC_SITE_URL
 * isn't set in Vercel's Project Settings > Environment Variables - set that
 * env var for correctness if the production domain ever changes.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://performaxis-gov.vercel.app";
