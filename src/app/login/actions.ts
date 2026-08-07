"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

export async function signIn(_prevState: { error: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

/**
 * Sends a password-reset email. Always reports success regardless of
 * whether the address matches an account - Supabase's
 * resetPasswordForEmail already avoids confirming/denying an account's
 * existence server-side (prevents email enumeration), so the UI mirrors
 * that instead of leaking it back via an error message.
 *
 * Lands on the same /accept-invite page invites use rather than a second
 * page: Supabase's recovery link arrives the same way an invite link does
 * (session in the URL fragment, via redirectTo), and /accept-invite
 * already just checks for a session and asks for a new password - that's
 * exactly the recovery flow too.
 */
export async function requestPasswordReset(
  _prevState: { sent?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/accept-invite`,
  });

  // Same rate limit as invites (Supabase's built-in email service, no
  // custom SMTP configured) - worth surfacing specifically since it's an
  // expected condition during testing, not a real failure.
  if (error && (error as { code?: string }).code === "over_email_send_rate_limit") {
    return { error: "Too many emails sent recently. Wait a few minutes and try again." };
  }

  return { sent: true };
}
