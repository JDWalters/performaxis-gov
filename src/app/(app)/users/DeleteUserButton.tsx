"use client";

import { useTransition } from "react";
import { deleteUser } from "./actions";

export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Permanently delete ${name}'s account? This removes all their org access and can't be undone.`))
          return;
        const fd = new FormData();
        fd.set("userId", userId);
        startTransition(() => deleteUser(fd));
      }}
      className="text-xs font-semibold text-missed hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete user"}
    </button>
  );
}
