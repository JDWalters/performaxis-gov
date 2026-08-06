"use client";

import { useTransition } from "react";
import { saveCompetency, deleteCompetency, resetCompetencies } from "./actions";
import type { CompetencyRow, CompetencyGroup } from "@/lib/data/competencies";

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const GROUPS: CompetencyGroup[] = ["Leading", "Core"];

function CompetencyRowEditor({ orgId, c }: { orgId: string; c: CompetencyRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-1.5">
        <input
          className={FIELD_CLASS}
          defaultValue={c.name}
          onBlur={(e) => {
            if (e.target.value === c.name) return;
            const fd = new FormData();
            fd.set("id", c.id);
            fd.set("orgId", orgId);
            fd.set("name", e.target.value);
            fd.set("groupName", c.groupName ?? "");
            fd.set("drivingText", c.drivingText ?? "");
            startTransition(() => saveCompetency(fd));
          }}
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <select
          className={FIELD_CLASS}
          defaultValue={c.groupName ?? "Core"}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("id", c.id);
            fd.set("orgId", orgId);
            fd.set("name", c.name);
            fd.set("groupName", e.target.value);
            fd.set("drivingText", c.drivingText ?? "");
            startTransition(() => saveCompetency(fd));
          }}
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5 text-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove "${c.name}" from the competency framework?`)) return;
            const fd = new FormData();
            fd.set("id", c.id);
            startTransition(() => deleteCompetency(fd));
          }}
          className="text-xs font-semibold text-missed hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export function CompetencyEditor({ orgId, competencies }: { orgId: string; competencies: CompetencyRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-ink2">Competency framework</div>
        <span className="text-[11px] text-ink2">Regulations, 17 January 2014</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink2">
            <th className="px-3 py-1.5">Competency</th>
            <th className="px-3 py-1.5 text-center">Group</th>
            <th className="px-3 py-1.5 text-center" />
          </tr>
        </thead>
        <tbody>
          {competencies.map((c) => (
            <CompetencyRowEditor key={c.id} orgId={orgId} c={c} />
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const fd = new FormData();
            fd.set("orgId", orgId);
            fd.set("name", "New competency");
            fd.set("groupName", "Core");
            startTransition(() => saveCompetency(fd));
          }}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
        >
          + Add competency
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Replace the entire competency framework with the 12 prescribed competencies? This removes any custom ones.")) return;
            const fd = new FormData();
            fd.set("orgId", orgId);
            startTransition(() => resetCompetencies(fd));
          }}
          className="text-xs font-semibold text-ink2 hover:underline disabled:opacity-50"
        >
          Restore the 12 prescribed competencies
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink2">All competencies carry equal weighting within the competency component.</p>
    </div>
  );
}
