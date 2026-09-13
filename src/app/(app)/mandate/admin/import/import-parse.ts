/**
 * Client-side file parsing for the bulk delegation importer - ported line
 * for line from admin.js's parseCsv()/zipEntries()/zipRead()/xmlDoc()/
 * colIndex()/readXlsx()/loadRows(). The reference deliberately reads .xlsx
 * files itself (a zip of XML) using the browser's own DecompressionStream
 * rather than pulling in a spreadsheet library, so no xlsx/exceljs/papaparse
 * dependency is added here either - this file is the same approach in
 * TypeScript.
 */

export type ImportTarget = {
  k: string;
  l: string;
  req?: boolean;
  alt: string[];
};

/* Column names this importer understands, and the field each fills.
   Ported verbatim from admin.js's TARGETS. */
export const TARGETS: ImportTarget[] = [
  { k: "ref", l: "Reference", alt: ["ref", "reference", "ref no", "ref.", "item ref"] },
  {
    k: "legislation",
    l: "Legislation / regulation / by-law / policy",
    req: true,
    alt: ["legislation", "legislation / schedule", "act", "instrument", "legislation/regulation/bylaw/policy"],
  },
  { k: "instrumentType", l: "Kind of instrument", alt: ["kind of instrument", "instrument type", "type"] },
  { k: "provision", l: "Section", alt: ["section", "provision", "clause", "section/provision", "section / provision"] },
  { k: "description", l: "Power conferred", req: true, alt: ["power conferred", "power", "power or duty", "description"] },
  { k: "delegatingAuthority", l: "Delegating authority", alt: ["delegating authority", "authority"] },
  {
    k: "delegated",
    l: "Delegated (Yes / No / Not delegable)",
    alt: ["delegated", "delegated?", "delegable", "delegated yes/no", "status"],
  },
  { k: "delegatedBody", l: "Delegated body", alt: ["delegated body"] },
  { k: "delegate", l: "Delegated to", alt: ["delegated to", "delegate"] },
  { k: "subDelegate", l: "Sub-delegated to", alt: ["sub-delegated to", "sub delegated to"] },
  { k: "furtherSubDelegate", l: "Further sub-delegated to", alt: ["further sub-delegated to"] },
  { k: "conditions", l: "Conditions", alt: ["conditions", "conditions and limitations", "conditions, directions and limitations"] },
  { k: "reviewStatus", l: "Legal review status", alt: ["legal review status", "review status"] },
  { k: "reviewNote", l: "Legal review note", alt: ["legal review note", "review note"] },
  { k: "establishmentNote", l: "Establishment note", alt: ["establishment note"] },
  { k: "band", l: "Grouping", alt: ["grouping", "band", "group", "theme", "part", "heading"] },
  { k: "sourceRef", l: "Source", alt: ["source", "source reference"] },
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

/* ---------- .xlsx reading (zip of XML, unzipped with DecompressionStream) ---------- */

type ZipEntry = { method: number; csize: number; lho: number };

function zipEntries(buf: ArrayBuffer): Record<string, ZipEntry> {
  const dv = new DataView(buf);
  let end = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("That file is not a readable .xlsx workbook.");
  const count = dv.getUint16(end + 10, true);
  let at = dv.getUint32(end + 16, true);
  const out: Record<string, ZipEntry> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(at, true) !== 0x02014b50) break;
    const nlen = dv.getUint16(at + 28, true);
    const xlen = dv.getUint16(at + 30, true);
    const clen = dv.getUint16(at + 32, true);
    const method = dv.getUint16(at + 10, true);
    const csize = dv.getUint32(at + 20, true);
    const lho = dv.getUint32(at + 42, true);
    const name = dec.decode(new Uint8Array(buf, at + 46, nlen));
    out[name] = { method, csize, lho };
    at += 46 + nlen + xlen + clen;
  }
  return out;
}

async function zipRead(buf: ArrayBuffer, entries: Record<string, ZipEntry>, name: string): Promise<string> {
  const e = entries[name];
  if (!e) return "";
  const dv = new DataView(buf);
  const nlen = dv.getUint16(e.lho + 26, true);
  const xlen = dv.getUint16(e.lho + 28, true);
  const start = e.lho + 30 + nlen + xlen;
  const bytes = new Uint8Array(buf, start, e.csize);
  if (e.method === 0) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open .xlsx files. Save the sheet as CSV and load that instead.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const blob = new Blob([new Uint8Array(bytes)]);
  const out = blob.stream().pipeThrough(ds);
  return await new Response(out).text();
}

function xmlDoc(text: string): Document {
  const d = new DOMParser().parseFromString(text, "application/xml");
  if (d.getElementsByTagName("parsererror").length) {
    throw new Error("That workbook could not be read. Save it as CSV and load that instead.");
  }
  return d;
}

function colIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const entries = zipEntries(buf);

  let sheetPath = "xl/worksheets/sheet1.xml";
  try {
    const wbx = xmlDoc(await zipRead(buf, entries, "xl/workbook.xml"));
    const first = wbx.getElementsByTagName("sheet")[0];
    const rid = first && (first.getAttribute("r:id") || first.getAttribute("id"));
    if (rid) {
      const rels = xmlDoc(await zipRead(buf, entries, "xl/_rels/workbook.xml.rels"));
      const list = rels.getElementsByTagName("Relationship");
      for (let k = 0; k < list.length; k++) {
        if (list[k].getAttribute("Id") === rid) {
          const target = (list[k].getAttribute("Target") || "").replace(/^\/xl\//, "").replace(/^\.\//, "");
          sheetPath = target.indexOf("xl/") === 0 ? target : "xl/" + target;
        }
      }
    }
  } catch {
    /* fall back to sheet1 */
  }

  const shared: string[] = [];
  if (entries["xl/sharedStrings.xml"]) {
    const sx = xmlDoc(await zipRead(buf, entries, "xl/sharedStrings.xml"));
    const sis = sx.getElementsByTagName("si");
    for (let a = 0; a < sis.length; a++) {
      const ts = sis[a].getElementsByTagName("t");
      let txt = "";
      for (let b = 0; b < ts.length; b++) txt += ts[b].textContent;
      shared.push(txt);
    }
  }

  const sh = xmlDoc(await zipRead(buf, entries, sheetPath));
  const rowEls = sh.getElementsByTagName("row");
  const rows: string[][] = [];
  for (let r = 0; r < rowEls.length; r++) {
    const cells = rowEls[r].getElementsByTagName("c");
    const line: string[] = [];
    for (let c = 0; c < cells.length; c++) {
      const cel = cells[c];
      const at = cel.getAttribute("r") || "";
      const t = cel.getAttribute("t");
      const idx = at ? colIndex(at) : c;
      const v = cel.getElementsByTagName("v")[0];
      let val = "";
      if (t === "s") val = shared[Number(v ? v.textContent : -1)] || "";
      else if (t === "inlineStr") {
        const its = cel.getElementsByTagName("t");
        for (let q = 0; q < its.length; q++) val += its[q].textContent;
      } else val = v ? v.textContent || "" : "";
      while (line.length < idx) line.push("");
      line[idx] = String(val);
    }
    rows.push(line);
  }
  return rows.filter((x) => x.some((y) => String(y).trim()));
}

export type LoadedRows = {
  headers: string[];
  rows: string[][];
  map: Record<string, number>;
  name: string;
};

/** Ported from admin.js's loadRows(): finds the header row, then auto-matches each TARGET to a column by name. */
export function loadRows(rows: string[][], name: string): LoadedRows {
  if (!rows || rows.length < 2) throw new Error("That file has no data rows in it.");
  let hi = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (rows[i].filter((c) => String(c).trim()).length > 2) {
      hi = i;
      break;
    }
  }
  const headers = rows[hi].map((h) => String(h).trim());
  const dataRows = rows.slice(hi + 1);
  const map: Record<string, number> = {};
  TARGETS.forEach((t) => {
    let found = -1;
    headers.forEach((h, i) => {
      const n = h.toLowerCase().replace(/\s+/g, " ").trim();
      if (found < 0 && (n === t.l.toLowerCase() || t.alt.indexOf(n) >= 0)) found = i;
    });
    map[t.k] = found;
  });
  return { headers, rows: dataRows, map, name };
}

export function cell(row: string[], map: Record<string, number>, key: string): string {
  const i = map[key];
  return i >= 0 && row[i] != null ? String(row[i]).trim() : "";
}

/** "Chief Financial Officer (FIN-01)" -> {id, wording} - ported from library.js's resolveNames(), for the client-side preview only. The server action re-resolves authoritatively against the live database. */
export function resolveOnePreview(
  text: string,
  authorities: { id: string; name: string; short: string | null }[]
): { id: string | null; label: string } {
  const t = text.trim().replace(/\.$/, "");
  if (!t || /^none$/i.test(t)) return { id: null, label: "" };
  const parenMatch = t.match(/\(([^)]+)\)\s*$/);
  const code = parenMatch ? parenMatch[1] : "";
  const bare = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const hit = authorities.find(
    (a) =>
      (code && (a.short || "").toLowerCase() === code.toLowerCase()) ||
      (a.short || "").toLowerCase() === t.toLowerCase() ||
      a.name.toLowerCase() === bare.toLowerCase()
  );
  if (hit) return { id: hit.id, label: hit.short || hit.name };
  return { id: null, label: t };
}
