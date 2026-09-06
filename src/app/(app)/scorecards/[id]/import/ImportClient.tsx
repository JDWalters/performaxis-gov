"use client";

import { useMemo, useState, useTransition } from "react";
import {
  computeCalcResult,
  friendlyActualValue,
  type CaptureKpi,
} from "@/lib/data/scorecards-shared";
import { importOfflineResults, type OfflineImportRow } from "../offline-actions";

type ParsedFile = {
  scorecardId?: string;
  quarter?: number;
  submittedBy?: string;
  submittedAt?: string;
  results?: OfflineImportRow[];
};

type DiffRow = {
  row: OfflineImportRow;
  kpi: CaptureKpi | null;
  proposedActual: string | null;
  proposedLabel: string | null;
  currentLabel: string | null;
  clash: boolean;
};

function buildDiff(rows: OfflineImportRow[], kpis: CaptureKpi[]): DiffRow[] {
  const byId = new Map(kpis.map((k) => [k.id, k]));
  return rows.map((row) => {
    const kpi = byId.get(row.scorecardKpiId) ?? null;
    if (!kpi) {
      return { row, kpi: null, proposedActual: null, proposedLabel: null, currentLabel: null, clash: false };
    }
    const get = (key: string): string => String((row as Record<string, unknown>)[key] ?? "");
    const { actual } = computeCalcResult(kpi.calc, get);
    const proposedLabel = friendlyActualValue(actual, kpi.calc);
    const currentLabel = friendlyActualValue(kpi.result?.actual ?? null, kpi.calc);
    return {
      row,
      kpi,
      proposedActual: actual,
      proposedLabel,
      currentLabel,
      clash: Boolean(currentLabel && proposedLabel && currentLabel !== proposedLabel),
    };
  });
}

export function ImportClient({
  scorecardId,
  quarter,
  kpis,
}: {
  scorecardId: string;
  quarter: number;
  kpis: CaptureKpi[];
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const diffRows = useMemo(() => (parsed?.results ? buildDiff(parsed.results, kpis) : []), [parsed, kpis]);

  function parseText(text: string) {
    setResult(null);
    try {
      const data = JSON.parse(text) as ParsedFile;
      if (!Array.isArray(data.results)) throw new Error("Missing results array.");
      setParsed(data);
      setParseError(null);
      const initial: Record<string, boolean> = {};
      for (const r of data.results) {
        const known = kpis.some((k) => k.id === r.scorecardKpiId);
        const hasData = Object.entries(r).some(
          ([k, v]) => !["scorecardKpiId", "refCode", "name"].includes(k) && v
        );
        initial[r.scorecardKpiId] = known && hasData;
      }
      setChecked(initial);
    } catch {
      setParsed(null);
      setParseError("That doesn't look like a valid offline-capture JSON file.");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setRaw(text);
      parseText(text);
    });
  }

  function handleImport() {
    if (!parsed?.results) return;
    const ticked = parsed.results.filter((r) => checked[r.scorecardKpiId]);
    if (ticked.length === 0) return;
    startTransition(async () => {
      try {
        const res = await importOfflineResults(scorecardId, quarter, ticked);
        setResult(res);
      } catch {
        setResult({ imported: 0, skipped: ticked.length, errors: ["Import failed - check your connection and try again."] });
      }
    });
  }

  const tickedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      {parsed && parsed.quarter != null && parsed.quarter !== quarter && (
        <p className="rounded-md bg-gold/10 px-3 py-2 text-xs font-semibold text-ink">
          This file was captured for Q{parsed.quarter}, but you&apos;re importing into Q{quarter}. Results will be
          saved against Q{quarter} if you continue.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
        <label className="text-xs font-semibold text-ink2">
          Upload the .json file downloaded from the offline capture form
          <input type="file" accept="application/json" onChange={handleFile} className="mt-1 block text-sm" />
        </label>
        <div className="text-center text-[11px] font-semibold uppercase text-ink2">or paste it below</div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => raw.trim() && parseText(raw)}
          rows={4}
          placeholder="Paste the JSON contents here…"
          className="rounded-md border border-line px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        {raw.trim() && (
          <button
            type="button"
            onClick={() => parseText(raw)}
            className="w-fit rounded-md border border-line bg-white px-3 py-1 text-xs font-bold text-ink2 hover:border-ink"
          >
            Parse
          </button>
        )}
        {parseError && <p className="text-xs font-semibold text-missed">{parseError}</p>}
      </div>

      {parsed && (
        <div className="flex flex-col gap-3">
          {parsed.submittedBy && (
            <p className="text-xs text-ink2">
              Submitted by <strong className="font-semibold text-ink">{parsed.submittedBy}</strong>
              {parsed.submittedAt ? ` on ${new Date(parsed.submittedAt).toLocaleString()}` : ""}
            </p>
          )}

          {diffRows.length === 0 ? (
            <p className="text-sm text-ink2">This file has no captured answers.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left text-[11px] font-bold uppercase text-ink2">
                    <th className="px-3 py-2">Import</th>
                    <th className="px-3 py-2">KPI</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(({ row, kpi, proposedLabel, currentLabel, clash }) => (
                    <tr key={row.scorecardKpiId} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          disabled={!kpi}
                          checked={Boolean(checked[row.scorecardKpiId])}
                          onChange={(e) =>
                            setChecked((prev) => ({ ...prev, [row.scorecardKpiId]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        {kpi ? (
                          <>
                            <div className="font-semibold text-ink">
                              {kpi.refCode ? `${kpi.refCode} — ` : ""}
                              {kpi.name}
                            </div>
                            {(row.comment || row.correctiveAction) && (
                              <div className="mt-0.5 text-[11px] text-ink2">
                                {row.comment && <div>Comment: {row.comment}</div>}
                                {row.correctiveAction && <div>Corrective action: {row.correctiveAction}</div>}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="font-semibold text-missed">
                            {row.name ?? row.scorecardKpiId} — not on this scorecard
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-ink2">{currentLabel ?? "—"}</td>
                      <td className={`px-3 py-2 align-top font-semibold ${clash ? "text-gold" : "text-ink"}`}>
                        {proposedLabel ?? "—"}
                        {clash && <div className="text-[11px] font-semibold text-gold">Differs from current</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={pending || tickedCount === 0}
              className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? "Importing…" : `Import ${tickedCount} ticked row${tickedCount === 1 ? "" : "s"}`}
            </button>
            {result && (
              <span className="text-sm font-semibold text-met">
                Imported {result.imported}
                {result.skipped ? `, skipped ${result.skipped}` : ""}.
              </span>
            )}
          </div>
          {result && result.errors.length > 0 && (
            <ul className="list-inside list-disc text-xs text-missed">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
