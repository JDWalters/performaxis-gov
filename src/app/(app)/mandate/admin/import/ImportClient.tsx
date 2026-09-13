"use client";

/**
 * Bulk delegation importer - ported from admin.js's importPage()/runImport()/
 * runPack(). Reading the file (CSV or .xlsx), auto-matching columns, and the
 * five-row preview all mirror the reference exactly; only the final write
 * happens server-side (import-parse.ts does the client-side reading, the
 * actual database inserts and authority-name resolution live in
 * ../actions.ts's importDelegations()/importBylawPack()). Markup uses this
 * port's own class vocabulary (.card/.card-h/.card-b, .dsec, .note) rather
 * than the reference's raw class names (.gbox, .govcard, .gfld), matching
 * every other Mandate screen in this app (see mandate.css's header note).
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TARGETS, parseCsv, readXlsx, loadRows, cell, resolveOnePreview, type LoadedRows } from "./import-parse";
import { importDelegations, importBylawPack, type ImportRow } from "../actions";

type Authority = { id: string; name: string; short: string | null };

type Mode = "append" | "replace" | "pack";

export function ImportClient({ orgId, authorities, startAsPack }: { orgId: string; authorities: Authority[]; startAsPack: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState<LoadedRows | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(startAsPack ? "pack" : "append");
  const [packName, setPackName] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; unresolved: number } | { saved: number } | null>(null);

  function apply(loaded: LoadedRows) {
    setLoaded(loaded);
    setMap(loaded.map);
    setError("");
    setResult(null);
  }

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setError("");
    if (/\.xlsx$/i.test(f.name)) {
      const rb = new FileReader();
      rb.onload = () => {
        readXlsx(rb.result as ArrayBuffer)
          .then((rows) => apply(loadRows(rows, f.name)))
          .catch((err: Error) => {
            setLoaded(null);
            setError(err.message || "That workbook could not be read. Save the sheet as CSV and load that instead.");
          });
      };
      rb.readAsArrayBuffer(f);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        apply(loadRows(parseCsv(r.result as string), f.name));
      } catch (err) {
        setLoaded(null);
        setError(err instanceof Error ? err.message : "That doesn't look like a valid CSV file.");
      }
    };
    r.readAsText(f);
  }

  function readPasted() {
    try {
      apply(loadRows(parseCsv(text), "pasted text"));
    } catch (err) {
      setLoaded(null);
      setError(err instanceof Error ? err.message : "That doesn't look like a valid CSV file.");
    }
  }

  function getCell(row: string[], key: string): string {
    return cell(row, map, key);
  }

  const missing = useMemo(() => {
    if (!loaded) return [];
    return TARGETS.filter((t) => {
      if (mode === "pack" && t.k === "legislation") return false; // the pack name is the instrument
      return t.req && (map[t.k] ?? -1) < 0;
    });
  }, [loaded, map, mode]);

  const previewRows = loaded ? loaded.rows.slice(0, 5) : [];

  function buildRows(): ImportRow[] {
    if (!loaded) return [];
    return loaded.rows.map((row) => ({
      ref: getCell(row, "ref"),
      legislation: getCell(row, "legislation"),
      instrumentType: getCell(row, "instrumentType"),
      provision: getCell(row, "provision"),
      description: getCell(row, "description"),
      delegatingAuthority: getCell(row, "delegatingAuthority"),
      delegated: getCell(row, "delegated"),
      delegatedBody: getCell(row, "delegatedBody"),
      delegate: getCell(row, "delegate"),
      subDelegate: getCell(row, "subDelegate"),
      furtherSubDelegate: getCell(row, "furtherSubDelegate"),
      conditions: getCell(row, "conditions"),
      reviewStatus: getCell(row, "reviewStatus"),
      reviewNote: getCell(row, "reviewNote"),
      establishmentNote: getCell(row, "establishmentNote"),
      band: getCell(row, "band"),
      sourceRef: getCell(row, "sourceRef"),
    }));
  }

  function submit() {
    if (!loaded) return;
    if (mode === "replace" && !confirm(`This deletes every row in the current register and puts the imported ones in their place. Go ahead?`)) {
      return;
    }
    setError("");
    const rows = buildRows();
    startTransition(async () => {
      try {
        if (mode === "pack") {
          const fd = new FormData();
          fd.set("orgId", orgId);
          fd.set("packName", packName);
          fd.set("sourceName", loaded.name);
          fd.set("rows", JSON.stringify(rows));
          const res = await importBylawPack(fd);
          setResult({ saved: res.saved });
        } else {
          const fd = new FormData();
          fd.set("orgId", orgId);
          fd.set("mode", mode);
          fd.set("sourceName", loaded.name);
          fd.set("rows", JSON.stringify(rows));
          const res = await importDelegations(fd);
          setResult({ imported: res.imported, unresolved: res.unresolved });
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="page" style={{ padding: "24px 26px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="phead">
        <div>
          <div className="eyebrow gold">Bulk load</div>
          <h1 className="serif">Import delegations</h1>
        </div>
      </div>
      <p className="pnote">
        An Excel workbook (.xlsx) or a comma-separated file (.csv), with one delegation to a row and a header row naming
        the columns. In a workbook the first sheet is the one that is read. The file that &quot;Export current view&quot;
        produces on the register imports straight back, so exporting, editing and re-importing is a supported round trip.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Choose a file</h3>
        </div>
        <div className="card-b">
          <div className="dsec">
            <div className="dsec-h">Excel workbook or CSV file</div>
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
            />
          </div>
          <div className="dsec">
            <div className="dsec-h">…or paste the rows here</div>
            <textarea rows={4} placeholder="Legislation,Section,Power conferred,…" value={text} onChange={(ev) => setText(ev.target.value)} />
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={readPasted} disabled={!text.trim()}>
                Read pasted text
              </button>
            </div>
          </div>
          {error && <div className="note d">{error}</div>}
        </div>
      </div>

      {loaded && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h3>Match the columns</h3>
            </div>
            <div className="card-b">
              <p className="muted small">
                {loaded.rows.length.toLocaleString("en-ZA")} rows read from {loaded.name}. Anything left as &quot;Not
                imported&quot; is ignored.
              </p>
              {TARGETS.map((t) => (
                <div key={t.k} className="drow">
                  <div className="dk">
                    {t.l}
                    {t.req ? " *" : ""}
                  </div>
                  <div className="dv">
                    <select value={map[t.k] ?? -1} onChange={(ev) => setMap((prev) => ({ ...prev, [t.k]: Number(ev.target.value) }))}>
                      <option value={-1}>Not imported</option>
                      {loaded.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h3>Check the first few rows</h3>
            </div>
            <div className="card-b">
              <div className="tw">
                <table className="reg">
                  <thead>
                    <tr>
                      <th>Legislation / regulation / by-law / policy</th>
                      <th>Section</th>
                      <th>Power conferred</th>
                      <th>Delegated to</th>
                      <th>Resolves to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const raw = getCell(row, "delegate");
                      const parts = raw.split(/\s*;\s*/).filter(Boolean);
                      const resolved = parts.map((p) => resolveOnePreview(p, authorities));
                      const ids = resolved.filter((r) => r.id).map((r) => r.label);
                      const wording = resolved.filter((r) => !r.id).map((r) => r.label);
                      return (
                        <tr key={i}>
                          <td>{getCell(row, "legislation")}</td>
                          <td className="mono small">{getCell(row, "provision")}</td>
                          <td>{getCell(row, "description").slice(0, 120)}</td>
                          <td className="small muted">{raw}</td>
                          <td>
                            <span className="mono small">{ids.join("; ") || "—"}</span>
                            {wording.length > 0 && (
                              <div className="small" style={{ fontStyle: "italic" }}>
                                kept as wording: {wording.join("; ")}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {missing.length > 0 && <div className="note d" style={{ marginTop: 12 }}>Still to match: {missing.map((t) => t.l).join(", ")}.</div>}

              <div className="dsec" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <div className="dsec-h">Where they go</div>
                <select value={mode} onChange={(ev) => setMode(ev.target.value as Mode)}>
                  <option value="append">Add these to this register</option>
                  <option value="replace">Replace the whole register with these</option>
                  <option value="pack">Save as an optional by-law pack in the library</option>
                </select>
              </div>

              {mode === "pack" && (
                <div className="note i" style={{ marginBottom: 12 }}>
                  A pack is not written into any register until a municipality adopts it from the library. Use this for
                  by-laws that only some clients have.
                  <div className="dsec" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
                    <div className="dsec-h">Name of the by-law</div>
                    <input
                      type="text"
                      value={packName}
                      placeholder="Kopanong Water Services By-law, 2024"
                      onChange={(ev) => setPackName(ev.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn pri"
                disabled={missing.length > 0 || pending || (mode === "pack" && !packName.trim())}
                onClick={submit}
              >
                {pending
                  ? "Working…"
                  : mode === "pack"
                    ? `Save ${loaded.rows.length.toLocaleString("en-ZA")} rows to the library`
                    : `Import ${loaded.rows.length.toLocaleString("en-ZA")} rows`}
              </button>

              {result && "imported" in result && (
                <p className="small" style={{ marginTop: 8 }}>
                  {result.imported.toLocaleString("en-ZA")} delegations imported.
                  {result.unresolved > 0 ? ` ${result.unresolved} chain entries were kept as wording (no matching post or body).` : ""}
                </p>
              )}
              {result && "saved" in result && (
                <p className="small" style={{ marginTop: 8 }}>
                  {result.saved.toLocaleString("en-ZA")} delegations saved to the library.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
