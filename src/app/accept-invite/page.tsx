"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

/**
 * Where every invite (and password-reset) email link actually lands. The
 * Supabase verify endpoint redirects here with the session in the URL
 * fragment - only the browser can read that, so this has to be a client
 * component: createClient() (createBrowserClient, detectSessionInUrl:true
 * by default) picks the token up off the URL on mount, exchanges it for a
 * real session, and persists it to cookies so the rest of the app's
 * server-rendered pages see the person as signed in too. Without this page
 * the invite email had nowhere useful to send anyone - the link would
 * "work" in the sense of not 404ing, but there was no form anywhere to
 * actually set a password.
 */
export default function AcceptInvitePage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setSaving(false);
      setError(updateErr.message);
      return;
    }
    // Full navigation, not router.push - the rest of the app is
    // server-rendered and reads the session from cookies on each request,
    // so this makes sure the very next page load sees it fresh.
    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/performaxis-logo.svg" alt="PerformAxis" width={280} height={120} priority />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink2">Government</p>
        </div>

        {status === "checking" && <p className="text-center text-sm text-ink2">Checking your invite…</p>}

        {status === "invalid" && (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-missed">
              This invite link is invalid or has expired. Ask whoever manages your municipality&apos;s account to
              send a new one.
            </p>
            <a href="/login" className="text-sm font-semibold text-blue hover:underline">
              Go to sign in
            </a>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink2">Welcome. Set a password to finish setting up your account.</p>

            <label className="flex flex-col gap-1 text-sm font-semibold text-ink2">
              New password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-ink2">
              Confirm password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            {error && (
              <p className="rounded-md bg-missed-bg px-3 py-2 text-sm font-medium text-missed">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink2">
        <span>Built by</span>
        <Image src="/fridayms.png" alt="Friday Management Solutions" width={80} height={30} />
      </div>
    </main>
  );
}
