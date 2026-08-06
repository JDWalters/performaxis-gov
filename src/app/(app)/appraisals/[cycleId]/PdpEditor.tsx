"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { addPdpItem, updatePdpItemField, deletePdpItem } from "./pdp-actions";
import { PDP_MODES, PDP_STATUSES, type PdpItem } from "@/lib/data/pdp-shared";

const CELL_CLASS =
  "w-full rounded-md border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

/** Free-text cell that only saves onBlur if it actually changed - same fix as every other capture surface in this app. */
function EditableCell({
  value,
  onSave,
  placeholder,
  multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);
  const common = {
    value: local,
    placeholder,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setLocal(e.target.value);
      dirtyRef.current = true;
    },
    onBlur: () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      onSave(local);
    },
    className: CELL_CLASS,
  };
  return multiline ? <textarea rows={2} {...common} /> : <input type="text" {...common} />;
}

function PdpRow({ cycleId, item }: { cycleId: string; item: PdpItem }) {
  const [, startTransition] = useTransition();

  const saveField = (field: string, value: string) => {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("cycleId", cycleId);
    fd.set("field", field);
    fd.set("value", value);
    startTransition(() => updatePdpItemField(fd));
  };

  return (
    <tr className="border-b border-line last:border-0">
      <td className="p-1">
        <button
          type="button"
          title="Remove this development need"
          onClick={() => {
            if (!confirm("Remove this development need?")) return;
            const fd = new FormData();
            fd.set("id", item.id);
            fd.set("cycleId", cycleId);
            startTransition(() => deletePdpItem(fd));
          }}
          className="rounded px-1.5 py-0.5 text-xs font-bold text-missed hover:bg-missed-bg"
        >
          ✕
        </button>
      </td>
      <td className="min-w-[80px] p-1">
        <EditableCell key={item.priority ?? ""} value={item.priority ?? ""} onSave={(v) => saveField("priority", v)} placeholder="Priority" />
      </td>
      <td className="min-w-[180px] p-1">
        <EditableCell key={item.gap ?? ""} value={item.gap ?? ""} multiline onSave={(v) => saveField("gap", v)} placeholder="Skills / performance gap" />
      </td>
      <td className="min-w-[180px] p-1">
        <EditableCell key={item.outcome ?? ""} value={item.outcome ?? ""} multiline onSave={(v) => saveField("outcome", v)} placeholder="Outcomes expected" />
      </td>
      <td className="min-w-[180px] p-1">
        <EditableCell key={item.activity ?? ""} value={item.activity ?? ""} multiline onSave={(v) => saveField("activity", v)} placeholder="Suggested training / development activity" />
      </td>
      <td className="min-w-[150px] p-1">
        <select
          defaultValue={item.mode ?? ""}
          onChange={(e) => saveField("mode", e.target.value)}
          className={CELL_CLASS}
        >
          <option value="">—</option>
          {PDP_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-[90px] p-1">
        <EditableCell key={item.timeframe ?? ""} value={item.timeframe ?? ""} onSave={(v) => saveField("timeframe", v)} placeholder="e.g. Q3" />
      </td>
      <td className="min-w-[180px] p-1">
        <EditableCell key={item.opportunity ?? ""} value={item.opportunity ?? ""} multiline onSave={(v) => saveField("opportunity", v)} placeholder="Work opportunity to practise" />
      </td>
      <td className="min-w-[110px] p-1">
        <EditableCell key={item.supportPerson ?? ""} value={item.supportPerson ?? ""} onSave={(v) => saveField("support_person", v)} placeholder="Support person" />
      </td>
      <td className="min-w-[70px] p-1">
        <EditableCell key={String(item.days ?? "")} value={item.days != null ? String(item.days) : ""} onSave={(v) => saveField("days", v)} placeholder="Days" />
      </td>
      <td className="min-w-[110px] p-1">
        <select
          defaultValue={item.status}
          onChange={(e) => saveField("status", e.target.value)}
          className={CELL_CLASS}
        >
          {PDP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export function PdpEditor({
  cycleId,
  items,
  totalDays,
  canEdit,
}: {
  cycleId: string;
  items: PdpItem[];
  totalDays: number;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const meetsGuideline = totalDays >= 5;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[9px] border border-line border-l-4 border-l-gold bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink2">
        <b className="text-ink">Personal Development Plan.</b> Identifies, prioritises and implements training needs
        arising from the competency assessment, the job competency profile and the employee&apos;s career needs. An
        employee should on average receive <b className="text-ink">at least five days of training per financial
        year</b>. The data collated from all employees forms the basis of the Workplace Skills Plan submitted to the
        LGSETA.
      </p>

      {canEdit && (
        <div>
          <button
            type="button"
            onClick={() => {
              const fd = new FormData();
              fd.set("cycleId", cycleId);
              startTransition(() => addPdpItem(fd));
            }}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink/90"
          >
            + Add development need
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink2">
          No development needs recorded yet. Add the skills or performance gaps identified during the assessment.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                  <th className="p-1" />
                  <th className="p-1">Priority</th>
                  <th className="p-1">1. Skills / gap</th>
                  <th className="p-1">2. Outcomes expected</th>
                  <th className="p-1">3. Suggested activity</th>
                  <th className="p-1">4. Mode of delivery</th>
                  <th className="p-1">5. Time frames</th>
                  <th className="p-1">6. Work opportunity</th>
                  <th className="p-1">7. Support person</th>
                  <th className="p-1">Days</th>
                  <th className="p-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <PdpRow key={item.id} cycleId={cycleId} item={item} />
                ))}
              </tbody>
            </table>
          </div>
          <span className={`stag w-fit ${meetsGuideline ? "stag-met" : "stag-almost"}`}>
            Total planned training days: <b>{totalDays.toFixed(1)}</b>
            {meetsGuideline ? " ✓ meets the five-day guideline" : " — the guideline is at least five days per financial year"}
          </span>
        </>
      )}
    </div>
  );
}
