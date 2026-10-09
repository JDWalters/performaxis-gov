"use client";

import { useState } from "react";
import { updateOrg } from "./actions";

const FIELD =
  "rounded-md border border-line px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

/**
 * Compact inline editor for one org's name + short code. Kind, parent and the
 * ltree path are intentionally not editable (see updateOrg in actions.ts).
 */
export function OrgEditButton({ orgId, name, code }: { orgId: string; name: string; code: string | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-blue hover:underline"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        try {
          await updateOrg(formData);
          setOpen(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save.");
        } finally {
          setPending(false);
        }
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="orgId" value={orgId} />
      <input name="name" defaultValue={name} required maxLength={200} aria-label="Name" className={`${FIELD} w-48`} />
      <input
        name="code"
        defaultValue={code ?? ""}
        maxLength={30}
        placeholder="Code"
        aria-label="Short code"
        className={`${FIELD} w-24`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs font-semibold text-ink2 hover:underline"
      >
        Cancel
      </button>
      {error && <span className="w-full text-xs font-medium text-red-600">{error}</span>}
    </form>
  );
}
