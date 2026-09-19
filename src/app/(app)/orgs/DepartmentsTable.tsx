"use client";

import { useRef, useState, useTransition } from "react";
import { createOrg, updateDepartmentDirector, setOrgActive } from "./actions";
import type { DepartmentRow } from "@/lib/data/orgs";

const FIELD_CLASS =
  "rounded-md border border-line px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

/** One editable "Director / Manager" cell - saves on blur, matching the reference table's inline-edit feel without a separate edit mode. */
function DirectorCell({ orgId, defaultValue }: { orgId: string; defaultValue: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const save = () => {
    if (value === (defaultValue ?? "")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("directorManagerName", value);
      await updateDepartmentDirector(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Not set"
        className={`${FIELD_CLASS} w-full`}
      />
      {saved && <span className="text-[10px] font-semibold text-met">Saved</span>}
    </div>
  );
}

function AddDepartmentRow({ municipalityOrgId }: { municipalityOrgId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-fit rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
      >
        + Add department
      </button>
    );
  }

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
            setOpen(false);
            setStatus("idle");
          } catch (e) {
            setStatus("error");
            setErrorMsg(e instanceof Error ? e.message : "Couldn't add that department.");
          }
        });
      }}
      className="mt-2 flex flex-wrap items-end gap-2"
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
        {status === "saving" ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-semibold text-ink2 hover:underline"
      >
        Cancel
      </button>
      {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
    </form>
  );
}

/**
 * Departments panel for SDBIP's Organisation setup - matches the reference
 * tool's table (Code, Department name, Director/Manager, KPIs(TL)) plus
 * "+ Add department". "KPIs (TL)" is a live count from scorecard_kpis'
 * dept_org_id on the Top Layer scorecard for the active financial year (see
 * getDepartmentsWithStats) - it's null (rendered as "—") when there's no
 * Top Layer scorecard for that year yet, distinct from a real zero.
 */
export function DepartmentsTable({
  municipalityOrgId,
  departments,
  financialYearLabel,
}: {
  municipalityOrgId: string;
  departments: DepartmentRow[];
  financialYearLabel: string | null;
}) {
  const [, startTransition] = useTransition();
  const active = departments.filter((d) => d.isActive);
  const inactive = departments.filter((d) => !d.isActive);

  const remove = (orgId: string) => {
    if (!confirm("Remove this department? Its scorecard data and KPI history are kept - it's just hidden from active lists.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("isActive", "false");
      await setOrgActive(fd);
    });
  };

  const restore = (orgId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("isActive", "true");
      await setOrgActive(fd);
    });
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink2">Departments</div>
      <p className="mb-3 text-[11px] text-ink2">
        Each department gets its own SDBIP scorecard. KPIs (TL) counts each department&apos;s KPIs on the Top
        Layer SDBIP{financialYearLabel ? ` for ${financialYearLabel}` : ""}. Changing a department code does not
        move existing KPIs - reassign them in Scorecard setup if needed. Removing a department does not delete its
        scorecard data.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink2">
              <th className="py-1.5 pr-3">Code</th>
              <th className="py-1.5 pr-3">Department name</th>
              <th className="py-1.5 pr-3">Director / Manager</th>
              <th className="py-1.5 pr-3 text-right">KPIs (TL)</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-ink2">
                  No departments yet.
                </td>
              </tr>
            )}
            {active.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3 align-top text-xs font-semibold text-ink2">{d.code ?? "—"}</td>
                <td className="py-1.5 pr-3 align-top font-semibold text-ink">{d.name}</td>
                <td className="py-1.5 pr-3 align-top">
                  <DirectorCell orgId={d.id} defaultValue={d.directorManagerName} />
                </td>
                <td className="py-1.5 pr-3 align-top text-right font-semibold text-ink">
                  {d.kpiTopLayerCount ?? "—"}
                </td>
                <td className="py-1.5 align-top text-right">
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="text-xs font-semibold text-missed hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inactive.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="text-[11px] font-semibold text-ink2">Removed:</span>
          {inactive.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => restore(d.id)}
              className="stag stag-missed hover:opacity-80"
              title="Click to restore"
            >
              {d.name} ↺
            </button>
          ))}
        </div>
      )}

      <AddDepartmentRow municipalityOrgId={municipalityOrgId} />
    </div>
  );
}
