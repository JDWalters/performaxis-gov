"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createOrg } from "./actions";
import { CREATABLE_KINDS, KIND_LABEL, parentKindFor, type OrgKind, type OrgOption } from "@/lib/data/orgs-shared";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";

export function CreateOrgForm({ orgs }: { orgs: OrgOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [kind, setKind] = useState<OrgKind>("municipality");
  const [isMetro, setIsMetro] = useState(false);
  const [, startTransition] = useTransition();

  const parentOptions = useMemo(() => {
    const wantKind = parentKindFor(kind, isMetro);
    return orgs.filter((o) => o.kind === wantKind).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs, kind, isMetro]);

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Create an org</div>
      <form
        ref={formRef}
        action={(formData) => {
          setStatus("saving");
          setErrorMsg("");
          startTransition(async () => {
            try {
              await createOrg(formData);
              formRef.current?.reset();
              setKind("municipality");
              setIsMetro(false);
              setStatus("done");
              setTimeout(() => setStatus("idle"), 3000);
            } catch (e) {
              setStatus("error");
              setErrorMsg(e instanceof Error ? e.message : "Couldn't create that org.");
            }
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className={LABEL_CLASS}>
          Type
          <select
            name="kind"
            required
            value={kind}
            onChange={(e) => setKind(e.target.value as OrgKind)}
            className={FIELD_CLASS}
          >
            {CREATABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Name
          <input type="text" name="name" required className={FIELD_CLASS} placeholder="e.g. Kopanong Local Municipality" />
        </label>

        <label className={LABEL_CLASS}>
          Code
          <input type="text" name="code" className={FIELD_CLASS} placeholder="Optional, e.g. KOP" />
        </label>

        <label className={LABEL_CLASS}>
          Parent {KIND_LABEL[parentKindFor(kind, isMetro)]}
          <select name="parentId" required defaultValue="" className={FIELD_CLASS}>
            <option value="" disabled>
              Select a parent…
            </option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.code ? ` (${o.code})` : ""}
              </option>
            ))}
          </select>
          {parentOptions.length === 0 && (
            <span className="text-[11px] font-medium text-missed">
              No {KIND_LABEL[parentKindFor(kind, isMetro)].toLowerCase()} org exists yet - create that first.
            </span>
          )}
        </label>

        {kind === "municipality" && (
          <label className="flex items-center gap-2 self-end pb-1.5 text-xs font-semibold text-ink2">
            <input
              type="checkbox"
              name="isMetro"
              checked={isMetro}
              onChange={(e) => setIsMetro(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            This is a metro (links straight to a province, skips district)
          </label>
        )}

        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            disabled={status === "saving" || parentOptions.length === 0}
            className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
          >
            {status === "saving" ? "Creating…" : "Create org"}
          </button>
          {status === "done" && <span className="text-xs font-semibold text-met">Org created.</span>}
          {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}
