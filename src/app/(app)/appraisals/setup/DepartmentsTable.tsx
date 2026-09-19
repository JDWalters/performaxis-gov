"use client";

import { useRef, useState, useTransition } from "react";
import { createOrg, setOrgActive } from "@/app/(app)/orgs/actions";
import type { DepartmentRow } from "@/lib/data/orgs";

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

/**
 * Departments panel for EPAS Setup - the one concrete gap the EPAS reference
 * audit found (punch-list item #1): a flat Code/Department table with
 * add/delete, simpler than SDBIP's version on `/orgs` (no Director/Manager
 * or KPI(TL) count columns - the reference EPAS Setup table is just Code +
 * Department name). Departments are the same `orgs` rows SDBIP's Departments
 * table manages (kind='department', parented under the municipality) - this
 * is a second, narrower view onto the same data, not a separate table, so
 * adding or removing a department here shows up on `/orgs` too and vice
 * versa. Reuses createOrg/setOrgActive from orgs/actions.ts rather than
 * duplicating the slug/path-building logic.
 */
export function DepartmentsTable({
  municipalityOrgId,
  departments,
}: {
  municipalityOrgId: string;
  departments: DepartmentRow[];
}) {
  const active = departments.filter((d) => d.isActive);
  const [, startTransition] = useTransition();

  const remove = (orgId: string) => {
    if (!confirm("Remove this department? Its data is kept - it's just hidden from active lists.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("isActive", "false");
      await setOrgActive(fd);
    });
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Departments</div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink2">
              <th className="py-1.5 pr-3">Code</th>
              <th className="py-1.5 pr-3">Department</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-sm text-ink2">
                  No departments yet.
                </td>
              </tr>
            )}
            {active.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3 align-top text-xs font-semibold text-ink2">{d.code ?? "—"}</td>
                <td className="py-1.5 pr-3 align-top font-semibold text-ink">{d.name}</td>
                <td className="py-1.5 align-top text-right">
                  <button type="button" onClick={() => remove(d.id)} className="text-xs font-semibold text-missed hover:underline">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddDepartmentRow municipalityOrgId={municipalityOrgId} />
    </div>
  );
}

function AddDepartmentRow({ municipalityOrgId }: { municipalityOrgId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setStatus("saving");
        setErrorMsg("");
        startTransition(async () => {
          try {
            await createOrg(formData);
            formRef.current?.reset();
            setStatus("idle");
          } catch (e) {
            setStatus("error");
            setErrorMsg(e instanceof Error ? e.message : "Couldn't add that department.");
          }
        });
      }}
      className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
    >
      <input type="hidden" name="kind" value="department" />
      <input type="hidden" name="parentId" value={municipalityOrgId} />
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
        Code
        <input name="code" className={FIELD_CLASS} placeholder="e.g. CMS" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
        Department name
        <input name="name" required className={FIELD_CLASS} placeholder="e.g. Corporate Services" />
      </label>
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50"
      >
        {status === "saving" ? "Adding…" : "+ Add department"}
      </button>
      {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
    </form>
  );
}
