"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-ink px-4 py-2 text-xs font-bold text-white"
    >
      Print (Ctrl/Cmd+P)
    </button>
  );
}
