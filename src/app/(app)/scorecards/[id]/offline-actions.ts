"use server";

/**
 * Offline capture form + inbox/import workflow.
 *
 * This is a deliberately safer redesign of the reference tool's equivalent
 * feature. The original shipped an anonymous Supabase *publishable* key
 * embedded in every generated static HTML file, so anyone holding that file
 * could write directly into the production database with no ownership
 * check at all (see readme.txt in the exported reference package). Our app
 * already has real Supabase Auth + RLS, so we don't need - and shouldn't
 * add - a second, unauthenticated write path into the same tables.
 *
 * Instead:
 *  - generateOfflineFormHtml() produces a fully self-contained HTML file
 *    (no embedded credentials, no network calls) that a capturer without
 *    connectivity can fill in offline. "Send my answers" doesn't POST
 *    anywhere - it downloads a small JSON file of what was typed.
 *  - importOfflineResults() is the only way that JSON ever reaches the
 *    database, and it runs as a normal authenticated Server Action: it
 *    re-validates every row belongs to the target scorecard, recomputes
 *    the canonical `actual` with the same computeCalcResult() used by
 *    manual capture, and upserts through the same RLS-gated kpi_results
 *    table - so an admin reviewing the import gets exactly the same
 *    guarantees as someone typing the numbers in by hand.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getScorecardDetail } from "@/lib/data/scorecards";
import type { KpiCalc } from "@/lib/data/scorecards-shared";
import { computeCalcResult } from "@/lib/data/kpi-calc-shared";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds a standalone HTML page for offline capture of one scorecard's
 * quarter. Every KPI that has a target set for this quarter gets inputs
 * matching computeCalcResult's expected field names, so the JSON it
 * produces on submit can be fed straight back through the same function
 * during import. Pure string generation - no server-only APIs referenced
 * inside the returned markup, since it runs in the capturer's own browser
 * later, completely detached from this app.
 */
export async function generateOfflineFormHtml(scorecardId: string, quarter: number): Promise<string> {
  const detail = await getScorecardDetail(scorecardId, quarter);
  if (!detail) throw new Error("Scorecard not found.");

  const capturable = detail.kpis.filter((k) => k.target != null && String(k.target).trim() !== "");

  const kpiPayload = capturable.map((k) => ({
    id: k.id,
    refCode: k.refCode,
    name: k.name,
    kpa: k.kpa,
    unitOfMeasure: k.unitOfMeasure,
    target: k.target,
    calc: k.calc,
    prior: {
      evidenceUrl: k.result?.evidenceUrl ?? "",
      evidenceDescription: k.result?.evidenceDescription ?? "",
      comment: k.result?.comment ?? "",
      correctiveAction: k.result?.correctiveAction ?? "",
      correctiveActionOwner: k.result?.correctiveActionOwner ?? "",
      correctiveActionDue: k.result?.correctiveActionDue ?? "",
    },
  }));

  const dataJson = JSON.stringify({
    scorecardId: detail.scorecardId,
    orgName: detail.orgName,
    quarter,
    generatedAt: new Date().toISOString(),
    kpis: kpiPayload,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline capture — ${escapeHtml(detail.orgName)} — Q${quarter}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 820px; margin: 0 auto; padding: 24px 16px 80px; color: #1a1a1a; background: #f7f6f3; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub { color: #6b6b6b; font-size: 13px; margin-bottom: 20px; }
  .notice { background: #fff8e6; border: 1px solid #e8c766; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
  .kpi { background: #fff; border: 1px solid #e2e0da; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .kpi h3 { margin: 0 0 2px; font-size: 14px; }
  .meta { color: #6b6b6b; font-size: 12px; margin-bottom: 10px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #4a4a4a; margin-top: 8px; }
  input[type=text], input[type=date], textarea { width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid #d6d3cb; border-radius: 6px; font-size: 13px; margin-top: 3px; font-family: inherit; }
  textarea { resize: vertical; min-height: 44px; }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .radios label { display: inline-flex; align-items: center; gap: 5px; font-weight: 400; margin-right: 14px; font-size: 13px; }
  #submitterName { max-width: 320px; }
  button { background: #1a1a1a; color: #fff; border: none; border-radius: 8px; padding: 11px 22px; font-size: 14px; font-weight: 700; cursor: pointer; }
  #status { margin-top: 14px; font-size: 13px; font-weight: 600; }
</style>
</head>
<body>
<h1>Offline capture — ${escapeHtml(detail.orgName)}</h1>
<div class="sub">Quarter ${quarter} · Generated ${new Date().toLocaleDateString()}</div>
<div class="notice">
  Fill this in without an internet connection, then click <strong>Save my answers</strong> below - it
  downloads a small file (not a live submission). Email that file back, or hand it to an admin, who
  will import it into PerformAxis under Scorecards → Import offline results.
</div>

<label for="submitterName">Your name</label>
<input type="text" id="submitterName" placeholder="Who is completing this form?" />

<form id="captureForm"></form>
<button id="saveBtn" type="button">Save my answers</button>
<div id="status"></div>

<script>
const DATA = ${dataJson};

function fieldsFor(kpi) {
  const c = kpi.calc || {};
  const t = c.type;
  if (t === "yesno") {
    return '<div class="radios"><label><input type="radio" name="ans_' + kpi.id + '" value="1"> Yes (achieved)</label>' +
      '<label><input type="radio" name="ans_' + kpi.id + '" value="0"> No (not achieved)</label></div>';
  }
  if (t === "rating") {
    const scale = c.scale || 5;
    let html = '<div class="radios">';
    for (let i = 1; i <= scale; i++) {
      html += '<label><input type="radio" name="rating_' + kpi.id + '" value="' + i + '"> ' + i + '</label>';
    }
    return html + '</div>';
  }
  if (t === "single") {
    return '<label>' + (c.labels && c.labels[0] ? c.labels[0] : "Result value") +
      '<input type="text" inputmode="decimal" id="value_' + kpi.id + '"></label>';
  }
  if (t === "ratio") {
    const fixedDen = typeof c.den === "number";
    let html = '<div class="row"><div><label>' + (c.labels && c.labels[0] ? c.labels[0] : "Numerator") +
      '<input type="text" inputmode="decimal" id="numerator_' + kpi.id + '"></label></div>';
    if (fixedDen) {
      html += '<div><label>' + (c.labels && c.labels[1] ? c.labels[1] : "Denominator") +
        '<input type="text" value="' + c.den + ' (fixed)" disabled></label></div>';
    } else {
      html += '<div><label>' + (c.labels && c.labels[1] ? c.labels[1] : "Denominator") +
        '<input type="text" inputmode="decimal" id="denominator_' + kpi.id + '"></label></div>';
    }
    return html + '</div>';
  }
  if (t === "three") {
    let html = '<div class="row">';
    ["a", "b", "c"].forEach((k, i) => {
      html += '<div><label>' + (c.labels && c.labels[i] ? c.labels[i] : k.toUpperCase()) +
        '<input type="text" inputmode="decimal" id="' + k + '_' + kpi.id + '"></label></div>';
    });
    return html + '</div>';
  }
  return '<label>Actual<input type="text" id="actual_' + kpi.id + '" placeholder="e.g. 80.78%"></label>';
}

const form = document.getElementById("captureForm");
DATA.kpis.forEach((kpi) => {
  const div = document.createElement("div");
  div.className = "kpi";
  div.innerHTML =
    '<h3>' + (kpi.refCode ? kpi.refCode + " — " : "") + kpi.name + '</h3>' +
    '<div class="meta">' + (kpi.kpa || "") + (kpi.unitOfMeasure ? " · " + kpi.unitOfMeasure : "") +
      ' · Target: ' + (kpi.target || "N/A") + '</div>' +
    fieldsFor(kpi) +
    '<label>Evidence URL<input type="text" id="evidenceUrl_' + kpi.id + '" value="' + (kpi.prior.evidenceUrl || "").replace(/"/g, "&quot;") + '"></label>' +
    '<label>Evidence description<textarea id="evidenceDescription_' + kpi.id + '">' + (kpi.prior.evidenceDescription || "") + '</textarea></label>' +
    '<label>Comment<textarea id="comment_' + kpi.id + '">' + (kpi.prior.comment || "") + '</textarea></label>' +
    '<label>Corrective action<textarea id="correctiveAction_' + kpi.id + '">' + (kpi.prior.correctiveAction || "") + '</textarea></label>' +
    '<div class="row">' +
      '<div><label>Corrective action owner<input type="text" id="correctiveActionOwner_' + kpi.id + '" value="' + (kpi.prior.correctiveActionOwner || "").replace(/"/g, "&quot;") + '"></label></div>' +
      '<div><label>Due date<input type="date" id="correctiveActionDue_' + kpi.id + '" value="' + (kpi.prior.correctiveActionDue || "") + '"></label></div>' +
    '</div>';
  form.appendChild(div);
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const results = DATA.kpis.map((kpi) => {
    const id = kpi.id;
    const type = (kpi.calc || {}).type;
    const g = (name) => { const el = document.getElementById(name + "_" + id); return el ? el.value.trim() : ""; };
    const radio = (name) => { const el = form.querySelector('input[name="' + name + '_' + id + '"]:checked'); return el ? el.value : ""; };
    const row = {
      scorecardKpiId: id,
      refCode: kpi.refCode,
      name: kpi.name,
      evidenceUrl: g("evidenceUrl"),
      evidenceDescription: g("evidenceDescription"),
      comment: g("comment"),
      correctiveAction: g("correctiveAction"),
      correctiveActionOwner: g("correctiveActionOwner"),
      correctiveActionDue: g("correctiveActionDue"),
    };
    if (type === "yesno") row.answer = radio("ans");
    else if (type === "rating") row.rating = radio("rating");
    else if (type === "single") row.value = g("value");
    else if (type === "ratio") { row.numerator = g("numerator"); row.denominator = g("denominator"); }
    else if (type === "three") { row.a = g("a"); row.b = g("b"); row.c = g("c"); }
    else row.actual = g("actual");
    return row;
  }).filter((r) => Object.entries(r).some(([k, v]) => !["scorecardKpiId", "refCode", "name"].includes(k) && v));

  const payload = {
    scorecardId: DATA.scorecardId,
    orgName: DATA.orgName,
    quarter: DATA.quarter,
    submittedBy: document.getElementById("submitterName").value.trim(),
    submittedAt: new Date().toISOString(),
    results,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "offline-capture-" + DATA.orgName.replace(/[^a-z0-9]+/gi, "-") + "-Q" + DATA.quarter + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  document.getElementById("status").textContent =
    "Saved " + results.length + " KPI answer(s) to a downloaded file. Send that file back to be imported.";
});
</script>
</body>
</html>`;
}

export type OfflineImportRow = {
  scorecardKpiId: string;
  refCode?: string | null;
  name?: string | null;
  answer?: string;
  rating?: string;
  value?: string;
  numerator?: string;
  denominator?: string;
  a?: string;
  b?: string;
  c?: string;
  actual?: string;
  evidenceUrl?: string;
  evidenceDescription?: string;
  comment?: string;
  correctiveAction?: string;
  correctiveActionOwner?: string;
  correctiveActionDue?: string;
};

/**
 * Imports a set of ticked rows from a parsed offline-capture JSON file into
 * kpi_results, for a given quarter. Every row is re-validated against the
 * target scorecard's actual KPIs (never trusts the file's own scorecardId),
 * and writes go through the exact same computeCalcResult() + upsert path as
 * manual capture (saveKpiResult), so RLS still gates who this can succeed
 * for and the stored `actual` is always derived server-side, never taken
 * verbatim from the file.
 */
export async function importOfflineResults(
  scorecardId: string,
  quarter: number,
  rows: OfflineImportRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  if (!scorecardId || !quarter) throw new Error("Missing scorecard or quarter.");
  if (!Array.isArray(rows) || rows.length === 0) return { imported: 0, skipped: 0, errors: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: kpiRows, error: kpiErr } = await supabase
    .from("scorecard_kpis")
    .select("id, kpi_library:kpi_library_id(calc_config)")
    .eq("scorecard_id", scorecardId);
  if (kpiErr) throw new Error(kpiErr.message);

  const byId = new Map(
    ((kpiRows ?? []) as unknown as { id: string; kpi_library: { calc_config: { calc?: KpiCalc } | null } | null }[]).map(
      (k) => [k.id, k.kpi_library?.calc_config?.calc ?? null]
    )
  );

  const errors: string[] = [];
  const upsertRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    if (!row.scorecardKpiId || !byId.has(row.scorecardKpiId)) {
      errors.push(`Skipped "${row.name ?? row.scorecardKpiId}" - not part of this scorecard.`);
      continue;
    }
    const calc = byId.get(row.scorecardKpiId) ?? null;
    const get = (key: string): string => String((row as Record<string, unknown>)[key] ?? "");
    const { actual, inputs } = computeCalcResult(calc, get);

    upsertRows.push({
      scorecard_kpi_id: row.scorecardKpiId,
      quarter,
      actual,
      inputs,
      evidence_url: row.evidenceUrl?.trim() || null,
      evidence_description: row.evidenceDescription?.trim() || null,
      comment: row.comment?.trim() || null,
      corrective_action: row.correctiveAction?.trim() || null,
      corrective_action_owner: row.correctiveActionOwner?.trim() || null,
      corrective_action_due: row.correctiveActionDue?.trim() || null,
      submitted_by: user?.id ?? null,
      submitted_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length === 0) return { imported: 0, skipped: rows.length, errors };

  const { error } = await (
    supabase.from("kpi_results") as unknown as {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(upsertRows, { onConflict: "scorecard_kpi_id,quarter" });

  if (error) throw new Error(error.message);

  revalidatePath(`/scorecards/${scorecardId}`);

  return { imported: upsertRows.length, skipped: rows.length - upsertRows.length, errors };
}
