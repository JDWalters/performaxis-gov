"use client";

import { useState } from "react";
import type { OrgOption, RoleOption } from "@/lib/data/users";

export type Grant = { orgId: string; roleId: string };

const KIND_LABEL: Record<string, string> = {
  national: "National",
  provincial: "Provincial",
  district: "District",
  municipality: "Municipality",
  department: "Department",
};

/**
 * One checkbox + role picker per org the caller is allowed to grant access
 * to - this is the "check the boxes for what they can access" control,
 * shared between the invite form (granting a brand-new set of orgs) and the
 * per-person "Edit access" panel (which pre-checks whatever they already
 * have). Selection state lives here and is handed up via onChange so the
 * parent can build the FormData/action payload however it needs to.
 */
export function OrgAccessChecklist({
  orgs,
  roles,
  initial,
  onChange,
}: {
  orgs: OrgOption[];
  roles: RoleOption[];
  initial: Grant[];
  onChange: (grants: Grant[]) => void;
}) {
  const defaultRoleId = roles[0]?.id ?? "";
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(initial.map((g) => [g.orgId, g.roleId]))
  );

  function emit(next: Map<string, string>) {
    setSelected(next);
    onChange([...next.entries()].map(([orgId, roleId]) => ({ orgId, roleId })));
  }

  function toggle(orgId: string, checked: boolean) {
    const next = new Map(selected);
    if (checked) next.set(orgId, selected.get(orgId) ?? defaultRoleId);
    else next.delete(orgId);
    emit(next);
  }

  function setRole(orgId: string, roleId: string) {
    const next = new Map(selected);
    next.set(orgId, roleId);
    emit(next);
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-line">
      {orgs.map((o) => {
        const checked = selected.has(o.id);
        return (
          <label
            key={o.id}
            className={`flex items-center gap-2.5 border-b border-line px-3 py-1.5 text-sm last:border-0 ${
              checked ? "bg-gold-bg/40" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => toggle(o.id, e.target.checked)}
              className="h-3.5 w-3.5 accent-gold"
            />
            <span className="flex-1 text-ink">
              {o.name} <span className="text-xs font-normal text-ink2">{KIND_LABEL[o.kind] ?? o.kind}</span>
            </span>
            <select
              disabled={!checked}
              value={selected.get(o.id) ?? defaultRoleId}
              onChange={(e) => setRole(o.id, e.target.value)}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-40"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
