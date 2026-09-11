"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "./actions";

/** A random 14-character password (mixed case, digits, a few symbols) - good enough to hand to someone as a temporary sign-in, not stored anywhere. */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  let pw = "";
  for (let i = 0; i < bytes.length; i++) pw += chars[bytes[i] % chars.length];
  return pw;
}

/**
 * The password-reset gate JD asked for - a Municipal/Platform Admin can set
 * someone's password directly instead of relying on Supabase's rate-limited
 * invite/reset emails (see the "over_email_send_rate_limit" note in
 * actions.ts). Opens inline in the Manage Users row rather than a modal,
 * matching DeleteUserButton's lightweight confirm-in-place pattern. The
 * generated/typed password is shown once after it's set so it can be copied
 * and handed to the person directly - Supabase never surfaces it again after
 * this call.
 */
export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setPassword(generatePassword());
          setResult(null);
          setError(null);
        }}
        className="text-xs font-semibold text-ink2 hover:underline"
      >
        Reset password
      </button>
    );
  }

  return (
    <div className="mt-1 flex w-56 flex-col gap-1.5 rounded-md border border-line bg-paper p-2">
      {result ? (
        <>
          <p className="text-xs font-semibold text-met">Password set for {name}.</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{result}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-xs font-semibold text-ink2 hover:underline"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-ink2">
            Share this with them directly - it won&apos;t be shown again. They should change it after signing in.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="self-start text-xs font-semibold text-ink2 hover:underline"
          >
            Close
          </button>
        </>
      ) : (
        <>
          <label className="text-xs font-semibold text-ink2">New password for {name}</label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-mono text-ink outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="text-xs font-semibold text-ink2 hover:underline"
            >
              Generate
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-missed">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending || password.length < 8}
              onClick={() => {
                setError(null);
                const fd = new FormData();
                fd.set("userId", userId);
                fd.set("newPassword", password);
                startTransition(async () => {
                  try {
                    await resetUserPassword(fd);
                    setResult(password);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Something went wrong.");
                  }
                });
              }}
              className="rounded-md bg-ink px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            >
              {pending ? "Setting…" : "Set password"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-ink2 hover:underline"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
