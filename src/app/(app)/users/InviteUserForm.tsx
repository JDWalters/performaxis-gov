"use client";

import { useRef, useState, useTransition } from "react";
import { inviteUser } from "./actions";
import { OrgAccessChecklist, type Grant } from "./OrgAccessChecklist";
import type { OrgOption, RoleOption } from "@/lib/data/users";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

export function InviteUserForm({ orgs, roles }: { orgs: OrgOption[]; roles: RoleOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink2">Invite a user</div>
      <p className="mb-3 text-xs text-ink2">
        Check every org they need. New email: sends one invite covering all of them. Email of someone who
        already has an account: just grants the checked orgs, no new invite sent.
      </p>
      <form
        ref={formRef}
        action={(formData) => {
          if (grants.length === 0) {
            setStatus("error");
            setErrorMsg("Check at least one org below.");
            return;
          }
          formData.set("grants", JSON.stringify(grants));
          setStatus("saving");
          setErrorMsg("");
          startTransition(async () => {
            try {
              const result = await inviteUser(formData);
              formRef.current?.reset();
              setGrants([]);
              setDoneMsg(
                result.existingUser
                  ? `Access granted to ${result.grantCount} org${result.grantCount === 1 ? "" : "s"} - they already had an account.`
                  : `Invite sent, with access to ${result.grantCount} org${result.grantCount === 1 ? "" : "s"}.`
              );
              setStatus("done");
              setTimeout(() => setStatus("idle"), 5000);
            } catch (e) {
              setStatus("error");
              setErrorMsg(e instanceof Error ? e.message : "Couldn't send the invite.");
            }
          });
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            Email
            <input type="email" name="email" required className={FIELD_CLASS} placeholder="name@example.gov.za" />
          </label>
          <label className={LABEL_CLASS}>
            Full name
            <input type="text" name="fullName" className={FIELD_CLASS} placeholder="Optional" />
          </label>
        </div>

        <div className={LABEL_CLASS}>
          Org access
          <OrgAccessChecklist orgs={orgs} roles={roles} initial={grants} onChange={setGrants} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {status === "saving" ? "Sending…" : "Send invite"}
          </button>
          {status === "done" && <span className="text-xs font-semibold text-met">{doneMsg}</span>}
          {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}
