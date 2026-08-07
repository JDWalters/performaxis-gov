"use client";

import { useRef, useState, useTransition } from "react";
import { inviteUser } from "./actions";
import type { OrgOption, RoleOption } from "@/lib/data/users";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

export function InviteUserForm({ orgs, roles }: { orgs: OrgOption[]; roles: RoleOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [wasExistingUser, setWasExistingUser] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink2">Invite a user</div>
      <p className="mb-3 text-xs text-ink2">
        New email: sends an invite. Email of someone who already has an account: just grants them this
        extra org, no new invite sent.
      </p>
      <form
        ref={formRef}
        action={(formData) => {
          setStatus("saving");
          setErrorMsg("");
          startTransition(async () => {
            try {
              const result = await inviteUser(formData);
              setWasExistingUser(result.existingUser);
              formRef.current?.reset();
              setStatus("done");
              setTimeout(() => setStatus("idle"), 4000);
            } catch (e) {
              setStatus("error");
              setErrorMsg(e instanceof Error ? e.message : "Couldn't send the invite.");
            }
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className={LABEL_CLASS}>
          Email
          <input type="email" name="email" required className={FIELD_CLASS} placeholder="name@example.gov.za" />
        </label>
        <label className={LABEL_CLASS}>
          Full name
          <input type="text" name="fullName" className={FIELD_CLASS} placeholder="Optional" />
        </label>
        <label className={LABEL_CLASS}>
          Org
          <select name="orgId" required defaultValue="" className={FIELD_CLASS}>
            <option value="" disabled>
              Select an org…
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Role
          <select name="roleId" required defaultValue="" className={FIELD_CLASS}>
            <option value="" disabled>
              Select a role…
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {status === "saving" ? "Sending invite…" : "Send invite"}
          </button>
          {status === "done" && (
            <span className="text-xs font-semibold text-met">
              {wasExistingUser ? "Access granted - they already had an account." : "Invite sent."}
            </span>
          )}
          {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}
