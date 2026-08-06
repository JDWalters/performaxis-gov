"use client";

import { useEffect } from "react";

/** Opens the print dialog shortly after the document mounts, mirroring the reference app's auto-print behaviour. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore - user can still use the on-page Print button
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-md bg-ink px-4 py-2 text-xs font-bold text-white">
      Print (Ctrl/Cmd+P)
    </button>
  );
}
