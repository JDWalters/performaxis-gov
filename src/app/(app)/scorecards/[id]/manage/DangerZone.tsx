"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetScorecardToEmpty } from "../kpi-admin-actions";

/**
 * Danger Zone - matches the reference tool's per-scorecard, per-financial-year
 * "Reset this scorecard" (Organisation setup, Panel 4): wipes this one
 * scorecard's KPI register and every captured result back to empty. Since
 * each `scorecards` row is already scoped to exactly one financial year, this
 * can never spill into another department or another year.
 *
 * Reference flow was `window.confirm` -> `window.prompt("type the admin
 * PIN")`. gov has no PIN (role-based RBAC gates this screen instead, see
 * detail.canManageSetup in manage/page.tsx), so the equivalent friction here
 * is a two-step confirm: (1) a CSV backup must actually be downloaded first
 * (tracked client-side, not just suggested - the Reset button stays disabled
 * until "Download backup" has been clicked), (2) the org name must be typed
 * exactly to arm the button, which itself opens a native confirm() as a
 * final "are you sure" before the irreversible delete fires.
 */
export function DangerZone({
  scorecardId,
  orgName,
  financialYearLabel,
}: {
  scorecardId: string;
  orgName: string;
  financialYearLabel: string | null;
}) {
  const [backedUp, setBackedUp] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  const fyLabel = financialYearLabel ?? "the current year";
  const armed = backedUp && confirmText.trim() === orgName.trim();

  function handleReset() {
    if (!armed) return;
    if (
      !window.confirm(
        `Reset ${orgName} for ${fyLabel} to empty, for ALL users? This deletes every KPI, target, and captured result on this scorecard. This cannot be undone.`
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => {
      try {
        const res = await resetScorecardToEmpty(scorecardId);
        setResult(`Reset complete - removed ${res.deleted} KPI${res.deleted === 1 ? "" : "s"} and all their captured results.`);
        setConfirmText("");
        setBackedUp(false);
        router.refresh();
      } catch (e) {
        setResult(e instanceof Error ? `Couldn't reset: ${e.message}` : "Couldn't reset - please try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border-2 border-missed/40 bg-missed/5 p-4">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-missed">Danger zone</div>
      <p className="mb-3 text-sm text-ink2">
        Resets the current scorecard (<span className="font-semibold text-ink">{orgName}</span>) for{" "}
        <span className="font-semibold text-ink">{fyLabel}</span> back to empty, for all users - every KPI, its
        quarterly targets, and every captured result on this scorecard is deleted. This can&apos;t be undone.
        Export a CSV backup first.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <a
          href={`/scorecards/${scorecardId}/export/register`}
          onClick={() => setBackedUp(true)}
          className="w-fit rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
        >
          {backedUp ? "✓ Backup downloaded - download again" : "⬇ Download backup (CSV)"}
        </a>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
          Type &quot;{orgName}&quot; to confirm
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={!backedUp}
            placeholder={orgName}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-missed focus:ring-2 focus:ring-missed/20 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={handleReset}
          disabled={!armed || pending}
          className="w-fit rounded-md bg-missed px-4 py-2 text-sm font-bold text-white hover:bg-missed/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Resetting…" : "Reset this scorecard"}
        </button>
      </div>

      {!backedUp && (
        <p className="mt-2 text-[11px] text-ink2">Download a backup CSV before the reset button unlocks.</p>
      )}
      {result && <p className="mt-2 text-xs font-semibold text-ink">{result}</p>}
    </div>
  );
}
