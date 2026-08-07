"use client";

import { useState, useTransition } from "react";
import { updateUserAccess } from "./actions";
import { OrgAccessChecklist, type Grant } from "./OrgAccessChecklist";
import { RevokeButton } from "./RevokeButton";
import type { OrgOption, RoleOption } from "@/lib/data/users";

type Membership = { membershipId: string; orgId: string; orgName: string; roleId: string; roleName: string };

/**
 * View mode shows the same "chip + Revoke" list as before; "Edit access"
 * swaps it for the checkbox checklist pre-checked to whatever this person
 * already holds, so granting or removing several orgs at once is one save
 * instead of one Revoke click per org plus a separate invite per addition.
 */
export function PersonAccessCell({
  userId,
  memberships,
  orgs,
  roles,
}: {
  userId: string;
  memberships: Membership[];
  orgs: OrgOption[];
  roles: RoleOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [grants, setGrants] = useState<Grant[]>(memberships.map((m) => ({ orgId: m.orgId, roleId: m.roleId })));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (!editing) {
    return (
      <div className="flex flex-col gap-1.5">
        {memberships.map((m) => (
          <div key={m.membershipId} className="flex flex-wrap items-center gap-2">
            <span className="stag stag-blue">
              {m.roleName} · {m.orgName}
            </span>
            <RevokeButton membershipId={m.membershipId} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-fit text-xs font-semibold text-ink2 hover:text-ink hover:underline"
        >
          + Edit access
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <OrgAccessChecklist orgs={orgs} roles={roles} initial={grants} onChange={setGrants} />
      {error && <span className="text-xs font-semibold text-missed">{error}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            const fd = new FormData();
            fd.set("userId", userId);
            fd.set("grants", JSON.stringify(grants));
            startTransition(async () => {
              try {
                await updateUserAccess(fd);
                setEditing(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't save access changes.");
              }
            });
          }}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save access"}
        </button>
        <button
          type="button"
          onClick={() => {
            setGrants(memberships.map((m) => ({ orgId: m.orgId, roleId: m.roleId })));
            setEditing(false);
            setError("");
          }}
          className="text-xs font-semibold text-ink2 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
