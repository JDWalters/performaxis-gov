"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { signIn, requestPasswordReset } from "./actions";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-sm font-semibold text-ink2";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, undefined);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, undefined);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/performaxis-logo.svg" alt="PerformAxis" width={280} height={120} priority />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink2">Government</p>
        </div>

        {mode === "signin" ? (
          <form action={signInAction} className="flex flex-col gap-4">
            <label className={LABEL_CLASS}>
              Email
              <input type="email" name="email" required autoComplete="email" className={FIELD_CLASS} />
            </label>

            <label className={LABEL_CLASS}>
              Password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className={FIELD_CLASS}
              />
            </label>

            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="self-end text-xs font-semibold text-blue hover:underline"
            >
              Forgot password?
            </button>

            {signInState?.error && (
              <p className="rounded-md bg-missed-bg px-3 py-2 text-sm font-medium text-missed">
                {signInState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={signInPending}
              className="mt-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {signInPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form action={resetAction} className="flex flex-col gap-4">
            <p className="text-sm text-ink2">
              Enter the email address on your account and we&apos;ll send you a link to set a new password.
            </p>

            <label className={LABEL_CLASS}>
              Email
              <input type="email" name="email" required autoComplete="email" className={FIELD_CLASS} />
            </label>

            {resetState?.error && (
              <p className="rounded-md bg-missed-bg px-3 py-2 text-sm font-medium text-missed">
                {resetState.error}
              </p>
            )}

            {resetState?.sent && (
              <p className="rounded-md bg-met-bg px-3 py-2 text-sm font-medium text-met">
                If that email has an account, a reset link is on its way - check your inbox.
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={resetPending}
                className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
              >
                {resetPending ? "Sending…" : "Send reset link"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs font-semibold text-blue hover:underline"
              >
                Back to sign in
              </button>
            </div>
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
