"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { savePolicyConfig } from "./actions";
import { LogoUploadField } from "./LogoUploadField";
import type { PolicyConfig, MayorTitle } from "@/lib/data/policy";
import type { BonusBand } from "@/lib/data/appraisal-scoring";

const FIELD_CLASS =
  "rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const LABEL_CLASS = "flex flex-col gap-1 text-xs font-semibold text-ink2";
const MAYOR_TITLES: MayorTitle[] = ["Executive Mayor", "Mayor"];

/**
 * Municipality identity, Mayor naming, KPA/competency weight split, and
 * bonus-band editor - mirrors the reference tool's Setup > Municipality and
 * Setup > Assessment weighting panels, but scoped to one org_id (this
 * municipality) instead of one global config.
 */
export function PolicyForm({ orgId, policy }: { orgId: string; policy: PolicyConfig }) {
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [bands, setBands] = useState<BonusBand[]>(policy.bonusBands);
  const [kpaWeight, setKpaWeight] = useState(String(policy.kpaWeight));
  const [compWeight, setCompWeight] = useState(String(policy.competencyWeight));
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const weightOk = useMemo(() => {
    const total = (Number(kpaWeight) || 0) + (Number(compWeight) || 0);
    return total === 100;
  }, [kpaWeight, compWeight]);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formData.set("bonusBandsJson", JSON.stringify(bands.filter((b) => b.pay.trim())));
        setStatus("saving");
        setErrorMsg("");
        startTransition(async () => {
          try {
            await savePolicyConfig(formData);
            setStatus("done");
            setTimeout(() => setStatus("idle"), 3000);
          } catch (e) {
            setStatus("error");
            setErrorMsg(e instanceof Error ? e.message : "Couldn't save the policy.");
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="orgId" value={orgId} />

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Municipality &amp; Mayor</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LogoUploadField orgId={orgId} defaultValue={policy.muniLogoUrl ?? ""} />
          <label className={LABEL_CLASS}>
            Mayoral title
            <select name="mayorTitle" defaultValue={policy.mayorTitle} className={FIELD_CLASS}>
              {MAYOR_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-normal normal-case text-ink2">
              Municipalities with an executive mayoral system have an Executive Mayor; a collective executive or
              plenary system has a Mayor.
            </span>
          </label>
          <label className={LABEL_CLASS}>
            {policy.mayorTitle} (name)
            <input name="mayorName" defaultValue={policy.mayorName ?? ""} className={FIELD_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Municipal Manager (name)
            <input name="mmName" defaultValue={policy.mmName ?? ""} className={FIELD_CLASS} />
            <span className="text-[11px] font-normal normal-case text-ink2">
              Shown as &quot;Employer&quot; on every Director&apos;s (Section 56) agreement - the {policy.mayorTitle.toLowerCase()} is
              the employer on the Municipal Manager&apos;s own (Section 57) agreement.
            </span>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            Default place of signature
            <input name="signPlaceDefault" defaultValue={policy.signPlaceDefault ?? ""} className={FIELD_CLASS} placeholder="e.g. Trompsburg" />
          </label>
          <label className={LABEL_CLASS}>
            Default month/year of signature
            <input name="signMonthDefault" defaultValue={policy.signMonthDefault ?? ""} className={FIELD_CLASS} placeholder="e.g. July 2026" />
          </label>
          <span className="text-[11px] font-normal normal-case text-ink2 sm:col-span-2">
            These are only pre-fill hints on new agreements - each employee&apos;s actual signed place/date is
            captured on their own agreement.
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink2">Assessment weighting</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL_CLASS}>
            KPAs (%)
            <input
              name="kpaWeight"
              value={kpaWeight}
              onChange={(e) => setKpaWeight(e.target.value)}
              inputMode="numeric"
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Competencies (%)
            <input
              name="competencyWeight"
              value={compWeight}
              onChange={(e) => setCompWeight(e.target.value)}
              inputMode="numeric"
              className={FIELD_CLASS}
            />
          </label>
        </div>
        <p className={`mt-2 text-xs font-semibold ${weightOk ? "text-met" : "text-missed"}`}>
          {weightOk
            ? "Current split totals 100%."
            : `These must total 100% - currently ${(Number(kpaWeight) || 0) + (Number(compWeight) || 0)}%.`}
        </p>

        <div className="mt-4 text-xs font-bold uppercase tracking-wide text-ink2">Performance bonus bands</div>
        <div className="mt-2 flex flex-col gap-2">
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-center gap-2">
              <input
                className={FIELD_CLASS}
                type="number"
                value={b.from}
                onChange={(e) => setBands((prev) => prev.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)))}
                placeholder="From %"
              />
              <input
                className={FIELD_CLASS}
                type="number"
                value={b.to}
                onChange={(e) => setBands((prev) => prev.map((x, j) => (j === i ? { ...x, to: Number(e.target.value) } : x)))}
                placeholder="To %"
              />
              <input
                className={FIELD_CLASS}
                value={b.pay}
                onChange={(e) => setBands((prev) => prev.map((x, j) => (j === i ? { ...x, pay: e.target.value } : x)))}
                placeholder="Bonus payable, e.g. 5% - 9%"
              />
              <button
                type="button"
                onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}
                className="text-xs font-semibold text-missed hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBands((prev) => [...prev, { from: 0, to: 0, pay: "" }])}
            className="w-fit rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-gold hover:text-ink"
          >
            + Add band
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink2">Percentages are of the fully effective standard (a weighted score of 3.00 = 100%).</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save policy"}
        </button>
        {status === "done" && <span className="text-xs font-semibold text-met">Saved.</span>}
        {status === "error" && <span className="text-xs font-semibold text-missed">{errorMsg}</span>}
      </div>
    </form>
  );
}
