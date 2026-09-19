"use client";

import { useState, useTransition } from "react";
import { updateMunicipalityIdentity } from "./actions";
import { LogoUploadField } from "@/app/(app)/appraisals/setup/LogoUploadField";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

/**
 * Surfaces Municipal Manager name + municipality logo on SDBIP's
 * Organisation setup screen - these already live on the one policy_templates
 * row per municipality and are edited on EPAS Setup (PolicyForm.tsx), but a
 * client evaluating the SDBIP module alone would never find them there (see
 * reference audit punch-list item #1). Saves through updateMunicipalityIdentity,
 * which only ever touches these two config keys - not the Mayor/weighting/
 * bonus-band fields EPAS Setup also owns on the same row.
 */
export function MunicipalityIdentityForm({
  orgId,
  mmName,
  muniLogoUrl,
}: {
  orgId: string;
  mmName: string | null;
  muniLogoUrl: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setStatus("saving");
        setErrorMsg("");
        startTransition(async () => {
          try {
            await updateMunicipalityIdentity(formData);
            setStatus("done");
            setTimeout(() => setStatus("idle"), 3000);
          } catch (e) {
            setStatus("error");
            setErrorMsg(e instanceof Error ? e.message : "Couldn't save.");
          }
        });
      }}
      className="rounded-xl border border-line bg-white p-4"
    >
      <input type="hidden" name="orgId" value={orgId} />
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Municipality</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LogoUploadField orgId={orgId} defaultValue={muniLogoUrl ?? ""} />
        <label className={LABEL_CLASS}>
          Municipal Manager (name)
          <input name="mmName" defaultValue={mmName ?? ""} className={FIELD_CLASS} />
          <span className="text-[11px] font-normal normal-case text-ink2">
            Same field as EPAS Setup&apos;s Municipal Manager name - editing it here updates it there too.
          </span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "done" && <span className="text-xs font-semibold text-met">Saved.</span>}
        {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
      </div>
    </form>
  );
}
