"use client";

import { useTransition } from "react";
import { revokeMembership } from "./actions";

export function RevokeButton({ membershipId }: { membershipId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Revoke this user's access to this org?")) return;
        const fd = new FormData();
        fd.set("membershipId", membershipId);
        startTransition(() => revokeMembership(fd));
      }}
      className="text-xs font-semibold text-missed hover:underline disabled:opacity-50"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
