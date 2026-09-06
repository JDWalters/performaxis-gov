"use client";

import { useState, useTransition } from "react";
import { generateOfflineFormHtml } from "./offline-actions";

/**
 * Fetches the generated standalone offline-capture HTML for this
 * scorecard+quarter and triggers a browser download - the file has no
 * network calls or embedded credentials, so it's safe to email around or
 * hand to someone without connectivity.
 */
export function DownloadOfflineFormButton({
  scorecardId,
  orgName,
  quarter,
}: {
  scorecardId: string;
  orgName: string;
  quarter: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const html = await generateOfflineFormHtml(scorecardId, quarter);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `offline-capture-${orgName.replace(/[^a-z0-9]+/gi, "-")}-Q${quarter}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Couldn't generate the offline form. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink2 hover:border-ink disabled:opacity-50"
      >
        {pending ? "Generating…" : "Download offline form"}
      </button>
      {error && <span className="text-[11px] font-semibold text-missed">{error}</span>}
    </div>
  );
}
