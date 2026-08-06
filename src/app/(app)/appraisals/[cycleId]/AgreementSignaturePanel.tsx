"use client";

import { useRef, useState, useTransition } from "react";
import { saveAgreementField, setAgreementStatus } from "./annexure-actions";
import type { AgreementSignature } from "@/lib/data/annexure";

const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-paper disabled:text-ink2";

/** Free-text/date field that only saves onBlur if it actually changed. */
function SignatureField({
  value,
  onSave,
  type = "text",
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);
  return (
    <input
      type={type}
      value={local}
      disabled={disabled}
      onChange={(e) => {
        setLocal(e.target.value);
        dirtyRef.current = true;
      }}
      onBlur={() => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        onSave(local);
      }}
      className={CELL_CLASS}
    />
  );
}

/**
 * Signature capture for the printed Performance Agreement - the reference
 * tool's signedEmp/signedEmpDate/signedMgr/signedMgrDate fields on the
 * agreement page, backed by the (previously dormant) agreements table. The
 * employee's own fields are editable by the employee (or an admin);
 * employer fields only by a real manager - mirrors the Ratings tab's
 * self/manager permission split.
 */
export function AgreementSignaturePanel({
  cycleId,
  agreement,
  canSignAsEmployer,
  canSignAsEmployee,
}: {
  cycleId: string;
  agreement: AgreementSignature;
  canSignAsEmployer: boolean;
  canSignAsEmployee: boolean;
}) {
  const [, startTransition] = useTransition();

  const save = (field: string, value: string) => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("field", field);
    fd.set("value", value);
    startTransition(() => saveAgreementField(fd));
  };

  const toggleStatus = () => {
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("status", agreement.status === "signed" ? "draft" : "signed");
    startTransition(() => setAgreementStatus(fd));
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-ink">Signature of the performance agreement</h3>
        <div className="flex items-center gap-2">
          <span className={`stag ${agreement.status === "signed" ? "stag-met" : "stag-pending"}`}>
            {agreement.status === "signed" ? "Signed" : "Draft"}
          </span>
          {canSignAsEmployer && (
            <button
              type="button"
              onClick={toggleStatus}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
            >
              {agreement.status === "signed" ? "Revert to draft" : "Mark as signed"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
          Signed by employee (name)
          <SignatureField
            key={agreement.employeeSignatory ?? ""}
            value={agreement.employeeSignatory ?? ""}
            disabled={!canSignAsEmployee}
            onSave={(v) => save("employeeSignatory", v)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
          Signed by employer (name)
          <SignatureField
            key={agreement.employerSignatory ?? ""}
            value={agreement.employerSignatory ?? ""}
            disabled={!canSignAsEmployer}
            onSave={(v) => save("employerSignatory", v)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
          Date signed
          <SignatureField
            key={agreement.signDate ?? ""}
            value={agreement.signDate ?? ""}
            type="date"
            disabled={!canSignAsEmployer && !canSignAsEmployee}
            onSave={(v) => save("signDate", v)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
          Place of signature
          <SignatureField
            key={agreement.signPlace ?? ""}
            value={agreement.signPlace ?? ""}
            disabled={!canSignAsEmployer}
            onSave={(v) => save("signPlace", v)}
          />
        </label>
      </div>
    </div>
  );
}
