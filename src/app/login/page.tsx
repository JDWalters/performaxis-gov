"use client";

import Image from "next/image";
import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/performaxis-logo.svg" alt="PerformAxis" width={280} height={120} priority />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink2">Government</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink2">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink2">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>

          {state?.error && (
            <p className="rounded-md bg-missed-bg px-3 py-2 text-sm font-medium text-missed">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink2">
        <span>Built by</span>
        <Image src="/fridayms.png" alt="Friday Management Solutions" width={80} height={30} />
      </div>
    </main>
  );
}
