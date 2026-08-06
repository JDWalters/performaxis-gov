"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEmployee } from "./actions";
import { ROLE_LABEL, reportsToLabel, type EmployeeRole, type EmployeeRow } from "@/lib/data/employees-shared";
import type { DepartmentOrg } from "@/lib/data/kpi-library";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";
const ROLES: EmployeeRole[] = ["MM", "DIR", "STAFF"];

/**
 * Add/edit form for one employee. Department options come from
 * getDepartmentOrgs() (already labelled with the owning municipality, so
 * this stays unambiguous once a second municipality exists) - every
 * employee, including the Municipal Manager, is attached to a department
 * org, matching how appraisals/scorecards are scoped everywhere else.
 */
export function EmployeeForm({ initial, departments }: { initial: EmployeeRow | null; departments: DepartmentOrg[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [role, setRole] = useState<EmployeeRole>(initial?.role ?? "DIR");
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <form
        ref={formRef}
        action={(formData) => {
          setStatus("saving");
          setErrorMsg("");
          startTransition(async () => {
            try {
              await saveEmployee(formData);
              setStatus("done");
              if (!initial) {
                formRef.current?.reset();
                setRole("DIR");
              }
              router.push("/employees");
              router.refresh();
            } catch (e) {
              setStatus("error");
              setErrorMsg(e instanceof Error ? e.message : "Couldn't save that employee.");
            }
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input type="hidden" name="id" value={initial?.id ?? ""} />

        <label className={LABEL_CLASS}>
          Full name
          <input name="name" defaultValue={initial?.name ?? ""} required className={FIELD_CLASS} placeholder="e.g. M Madolo" />
        </label>
        <label className={LABEL_CLASS}>
          Position
          <input
            name="position"
            defaultValue={initial?.position ?? ""}
            className={FIELD_CLASS}
            placeholder="e.g. Director: Technical Services"
          />
        </label>
        <label className={LABEL_CLASS}>
          Role
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as EmployeeRole)}
            className={FIELD_CLASS}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal normal-case text-ink2">
            Assessed by {reportsToLabel(role)}&apos;s panel.
          </span>
        </label>
        <label className={LABEL_CLASS}>
          Department
          <select name="orgId" defaultValue={initial?.orgId ?? ""} required className={FIELD_CLASS}>
            <option value="" disabled>
              Select a department…
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.municipalityName ? ` — ${d.municipalityName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Employee number
          <input name="empno" defaultValue={initial?.empno ?? ""} className={FIELD_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          Contract
          <input
            name="contract"
            defaultValue={initial?.contract ?? ""}
            className={FIELD_CLASS}
            placeholder="e.g. 5-year fixed term"
          />
        </label>

        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : initial ? "Save changes" : "Add employee"}
          </button>
          {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}
