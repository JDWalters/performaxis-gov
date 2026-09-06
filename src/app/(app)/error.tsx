"use client";

// Temporary-forever safety net: without this, any server-side error anywhere
// under (app) shows Next.js's generic "This page couldn't load" screen with
// nothing but an opaque digest - neither the user nor whoever's debugging can
// see what actually broke. This surfaces the real message + digest instead,
// so the next crash report comes with an actual reason attached.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-missed bg-missed-bg/40 p-5">
      <h2 className="text-lg font-extrabold text-ink">Something went wrong loading this page</h2>
      <p className="whitespace-pre-wrap break-words font-mono text-sm text-ink">{error.message || "(no message)"}</p>
      {error.digest && <p className="text-xs text-ink2">Digest: {error.digest}</p>}
      {error.stack && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-[11px] text-ink2">
          {error.stack}
        </pre>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-md bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/90"
      >
        Try again
      </button>
    </div>
  );
}
