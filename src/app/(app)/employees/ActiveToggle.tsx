"use client";

import { useTransition } from "react";
import { setEmployeeActive } from "./actions";

export function ActiveToggle({ employeeId, isActive }: { employeeId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const verb = isActive ? "deactivate" : "reactivate";
        if (!confirm(`Are you sure you want to ${verb} this employee?`)) return;
        const fd = new FormData();
        fd.set("id", employeeId);
        fd.set("isActive", isActive ? "0" : "1");
        startTransition(() => setEmployeeActive(fd));
      }}
      className={`text-xs font-semibold hover:underline disabled:opacity-50 ${isActive ? "text-missed" : "text-met"}`}
    >
      {pending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
