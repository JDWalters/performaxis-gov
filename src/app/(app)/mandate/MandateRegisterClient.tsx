"use client";

/**
 * The Mandate delegation register - ported from the reference app's
 * assets/register.js + assets/detail.js. Structure, class names, the four
 * figures, the filter bar, the sortable results table, paging, CSV export
 * and the delegation-detail drawer are all kept as close to the original as
 * a client-rendered React component can be, per JD's instruction to keep
 * the pages and functionality exactly as provided - only the data source
 * (performaxis-gov's own Supabase, via server-fetched props) and the access
 * model (has_org_access permissions instead of Mandate's own org_role) are
 * different.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateAuthority, MandateOrg, AuthorityMap } from "@/lib/data/mandate-shared";
import {
  authorityMap,
  alignment,
  alignmentReason,
  legislationOf,
  legLabel,
  postCodes,
  departmentsOf,
  nameList,
  authorityLabel,
  delegatedToLabel,
  ALIGN_LABEL,
  type Alignment,
} from "@/lib/data/mandate-shared";
import { DetailDrawer } from "./MandateDetailDrawer";
import { MandateEntryEditor } from "./MandateEntryEditor";

type SortKey = "ref" | "legislation" | "section" | "power" | "authority" | "delegated" | "status";

const COLS: { k: SortKey | null; l: string; w: string }[] = [
  { k: "ref", l: "Ref", w: "5.5%" },
  { k: "legislation", l: "Legislation / regulation / by-law / policy", w: "16%" },
  { k: "section", l: "Section/Provision", w: "9%" },
  { k: "power", l: "Power conferred", w: "22%" },
  { k: "authority", l: "Authority", w: "12%" },
  { k: "delegated", l: "Delegated to", w: "14%" },
  { k: null, l: "Post no(s)", w: "10%" },
  { k: "status", l: "Status", w: "9%" },
];

function sortValue(e: MandateEntry, org: MandateOrg, authorities: AuthorityMap, key: SortKey): string {
  switch (key) {
    case "ref":
      return e.ref || "";
    case "legislation":
      return legislationOf(e, org);
    case "section":
      return e.provision || "";
    case "power":
      return e.description || "";
    case "authority":
      return authorityLabel(e, authorities);
    case "delegated":
      return delegatedToLabel(e, authorities);
    case "status":
      return { aligned: "1", action: "2", statutory: "3", reserved: "4" }[alignment(e)];
  }
}

function q(v: string | null | undefined): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function MandateRegisterClient({
  orgs,
  org,
  entries,
  authorities: authorityList,
  canManage,
  canPropose,
}: {
  orgs: { id: string; name: string }[];
  org: MandateOrg;
  entries: MandateEntry[];
  authorities: MandateAuthority[];
  canManage: boolean;
  canPropose?: boolean;
}) {
  const router = useRouter();
  const authorities = useMemo(() => authorityMap(authorityList), [authorityList]);

  const [q_, setQ] = useState("");
  const [legislationFilter, setLegislationFilter] = useState("");
  const [department, setDepartment] = useState("");
  const [alignFilter, setAlignFilter] = useState<Alignment | "">("");
  const [exceptions, setExceptions] = useState(false);
  const [sort, setSort] = useState<SortKey>("status");
  const [dir, setDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(25);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function reset() {
    setQ("");
    setLegislationFilter("");
    setDepartment("");
    setAlignFilter("");
    setExceptions(false);
    setPage(1);
  }

  const legislationOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of entries) {
      const l = legislationOf(e, org);
      if (l) seen.set(l, (seen.get(l) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => legLabel(a[0], org).localeCompare(legLabel(b[0], org)))
      .map(([v, n]) => ({ v, l: `${legLabel(v, org)}  (${n})` }));
  }, [entries, org]);

  const departmentOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const a of authorityList) if (a.department) seen.add(a.department);
    return [...seen].map((d) => ({ v: d, l: d }));
  }, [authorityList]);

  const matching = useMemo(() => {
    const query = q_.trim().toLowerCase();
    return entries.filter((e) => {
      if (legislationFilter && legislationOf(e, org) !== legislationFilter) return false;
      if (department && !departmentsOf(e, authorities).includes(department)) return false;
      const a = alignment(e);
      if (alignFilter && a !== alignFilter) return false;
      if (exceptions && a === "aligned") return false;
      if (query) {
        const hay = [
          legislationOf(e, org),
          e.instrumentType || "",
          e.provision,
          e.description,
          e.conditions,
          authorityLabel(e, authorities),
          delegatedToLabel(e, authorities),
          nameList(e.subDelegateIds, e.subDelegateNote, authorities),
          postCodes(e, authorities).join(" "),
          e.reviewStatus,
          e.sourceRef,
          e.sourceLegislation,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [entries, org, authorities, q_, legislationFilter, department, alignFilter, exceptions]);

  const sorted = useMemo(() => {
    const rows = matching.slice();
    rows.sort((a, b) => {
      const r = String(sortValue(a, org, authorities, sort)).localeCompare(String(sortValue(b, org, authorities, sort)), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (r) return r * dir;
      return String(legislationOf(a, org) + a.provision).localeCompare(String(legislationOf(b, org) + b.provision), undefined, {
        numeric: true,
      });
    });
    return rows;
  }, [matching, org, authorities, sort, dir]);

  const actionCount = useMemo(() => entries.filter((e) => alignment(e) === "action").length, [entries]);
  const reservedCount = useMemo(() => entries.filter((e) => alignment(e) === "reserved").length, [entries]);

  const effPer = per === 0 ? sorted.length || 1 : per;
  const pages = Math.max(1, Math.ceil(sorted.length / effPer));
  const curPage = Math.min(page, pages);
  const start = (curPage - 1) * effPer;
  const slice = sorted.slice(start, start + effPer);

  function toggleAlignment(v: Alignment) {
    setAlignFilter((cur) => (cur === v ? "" : v));
    setExceptions(false);
    setPage(1);
  }

  function exportCsv() {
    const head = [
      "Ref",
      "Legislation / regulation / by-law / policy",
      "Kind of instrument",
      "Section/Provision",
      "Power conferred",
      "Delegating authority",
      "Delegated",
      "Delegated body",
      "Delegated to",
      "Sub-delegated to",
      "Further sub-delegated to",
      "Post no(s)",
      "Alignment",
      "Conditions",
      "Legal review status",
      "Legal review note",
      "Grouping",
      "Establishment note",
      "Source",
    ];
    const YESNO: Record<string, string> = { delegated: "Yes", reserved: "No", not_delegable: "Not delegable", automatic: "—" };
    const lines = [head.map(q).join(",")];
    for (const e of sorted) {
      lines.push(
        [
          e.ref || "",
          legislationOf(e, org),
          e.instrumentType || "",
          e.provision,
          e.description,
          nameList(e.delegatingAuthorityIds, e.delegatingAuthorityNote, authorities),
          YESNO[e.status] || "",
          nameList(e.delegatedBodyIds, e.delegatedBodyNote, authorities),
          nameList(e.delegateIds, e.delegateNote, authorities),
          nameList(e.subDelegateIds, e.subDelegateNote, authorities),
          nameList(e.furtherSubDelegateIds, e.furtherSubDelegateNote, authorities),
          postCodes(e, authorities).join("; "),
          ALIGN_LABEL[alignment(e)],
          e.conditions,
          e.reviewStatus,
          e.reviewNote,
          e.band || "",
          e.establishmentNote,
          e.sourceRef,
        ]
          .map(q)
          .join(",")
      );
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(org.shortName || "delegations").toLowerCase().replace(/\s+/g, "-")}-register-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const detailEntry = detailId ? entries.find((e) => e.id === detailId) ?? null : null;

  return (
    <div className="page wide" style={{ padding: "24px 26px 60px", maxWidth: 1600, margin: "0 auto" }}>
      {orgs.length > 1 && (
        <div className="btnrow" style={{ marginBottom: 14 }}>
          <span className="eyebrow" style={{ marginBottom: 0 }}>
            Client
          </span>
          <select
            value={org.id}
            onChange={(ev) => router.push(`/mandate?org=${ev.target.value}`)}
            style={{ width: "auto", minWidth: 220 }}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="kpis">
        <div
          className="kpi act"
          role="button"
          tabIndex={0}
          onClick={reset}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && reset()}
        >
          <div className="k">Total delegations</div>
          <div className="v">{entries.length.toLocaleString("en-ZA")}</div>
          <div className="s">Consolidated operative rows</div>
        </div>
        <div className="kpi">
          <div className="k">Current view</div>
          <div className="v">{matching.length.toLocaleString("en-ZA")}</div>
          <div className="s">Matching filters and search</div>
        </div>
        <div
          className={`kpi act bad${alignFilter === "action" ? " on" : ""}`}
          role="button"
          tabIndex={0}
          title={alignFilter === "action" ? "Showing only these — click to clear" : "Show only these delegations"}
          onClick={() => toggleAlignment("action")}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && toggleAlignment("action")}
        >
          <div className="k">Action required</div>
          <div className="v">{actionCount.toLocaleString("en-ZA")}</div>
          <div className="s">Organogram or designation gaps</div>
        </div>
        <div
          className={`kpi act warn${alignFilter === "reserved" ? " on" : ""}`}
          role="button"
          tabIndex={0}
          title={alignFilter === "reserved" ? "Showing only these — click to clear" : "Show only these delegations"}
          onClick={() => toggleAlignment("reserved")}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && toggleAlignment("reserved")}
        >
          <div className="k">Council reserved</div>
          <div className="v">{reservedCount.toLocaleString("en-ZA")}</div>
          <div className="s">No post mapping required</div>
        </div>
      </div>

      <section className="regpanel">
        <div className="regpanel-h">
          <div>
            <div className="eyebrow gold">Master register</div>
            <h1 className="serif">Find a delegated power</h1>
          </div>
          <div className="btnrow">
            <button
              type="button"
              className={`btn ghost-dgr${exceptions ? " on" : ""}`}
              title="Everything that is not aligned — gaps and reserved powers together"
              onClick={() => {
                setExceptions((v) => !v);
                setAlignFilter("");
                setPage(1);
              }}
            >
              {exceptions ? "Showing exceptions" : "Show exceptions"}
            </button>
            <button type="button" className="btn" onClick={exportCsv}>
              Export current view
            </button>
            {canManage && (
              <button type="button" className="btn pri" title="Administrator: add a row to the register directly" onClick={() => setShowAdd(true)}>
                + Add a delegation
              </button>
            )}
          </div>
        </div>

        <div className="regfilters">
          <div className="rf grow">
            <span>Search the full register</span>
            <div className="searchwrap">
              <span className="mag">⌕</span>
              <input
                type="search"
                value={q_}
                placeholder="Power, Act, section, post or delegate…"
                onChange={(ev) => {
                  setQ(ev.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="rf">
            <span>Legislation / regulation / by-law / policy</span>
            <select
              className={legislationFilter ? "on" : ""}
              value={legislationFilter}
              onChange={(ev) => {
                setLegislationFilter(ev.target.value);
                setPage(1);
              }}
            >
              <option value="">All instruments</option>
              {legislationOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="rf">
            <span>Department</span>
            <select
              className={department ? "on" : ""}
              value={department}
              onChange={(ev) => {
                setDepartment(ev.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {departmentOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="rf">
            <span>Alignment</span>
            <select
              className={alignFilter ? "on" : ""}
              value={alignFilter}
              onChange={(ev) => {
                setAlignFilter(ev.target.value as Alignment | "");
                setExceptions(false);
                setPage(1);
              }}
            >
              <option value="">All alignment statuses</option>
              <option value="aligned">{ALIGN_LABEL.aligned}</option>
              <option value="action">{ALIGN_LABEL.action}</option>
              <option value="statutory">{ALIGN_LABEL.statutory}</option>
              <option value="reserved">{ALIGN_LABEL.reserved}</option>
            </select>
          </div>
          <button type="button" className="linkbtn" onClick={reset}>
            Clear filters
          </button>
        </div>

        <div className="regmeta">
          <span className="count">
            {sorted.length.toLocaleString("en-ZA")} {sorted.length === 1 ? "result" : "results"}
          </span>
          <label className="per">
            <span>Rows per page</span>
            <select
              value={per}
              onChange={(ev) => {
                setPer(Number(ev.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>All</option>
            </select>
          </label>
        </div>

        {sorted.length === 0 ? (
          <div className="empty">
            <h3>Nothing matches those filters.</h3>
            <p className="muted">Widen the search, or clear the filters to see the whole register.</p>
            <button type="button" className="btn" onClick={reset}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="regtable">
              <table className="reg">
                <colgroup>
                  {COLS.map((c, i) => (
                    <col key={i} style={{ width: c.w }} />
                  ))}
                  <col style={{ width: 46 }} />
                </colgroup>
                <thead>
                  <tr>
                    {COLS.map((c) =>
                      c.k ? (
                        <th key={c.l} className={`sortable${sort === c.k ? " on" : ""}`}>
                          <button
                            type="button"
                            title={`Sort by ${c.l.toLowerCase()}`}
                            onClick={() => {
                              if (sort === c.k) setDir((d) => (d === 1 ? -1 : 1));
                              else {
                                setSort(c.k as SortKey);
                                setDir(1);
                              }
                            }}
                          >
                            <span>{c.l}</span>
                            <span className="sarrow">{sort === c.k ? (dir > 0 ? "↑" : "↓") : "⇅"}</span>
                          </button>
                        </th>
                      ) : (
                        <th key={c.l}>{c.l}</th>
                      )
                    )}
                    <th className="go" aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e) => {
                    const a = alignment(e);
                    const codes = postCodes(e, authorities);
                    return (
                      <tr key={e.id} className="clickable" onClick={() => setDetailId(e.id)}>
                        <td>
                          <span className="refno">{e.ref || "—"}</span>
                        </td>
                        <td>
                          <span className="leg" title={legislationOf(e, org)}>
                            {legLabel(legislationOf(e, org), org)}
                          </span>
                          {e.instrumentType && <span className="legkind">{e.instrumentType}</span>}
                          {e.instrumentToConfirm && <span className="legkind warn">to be confirmed</span>}
                        </td>
                        <td>
                          <span className="sec">{e.provision || "—"}</span>
                        </td>
                        <td>
                          <span className="pw">{e.description}</span>
                        </td>
                        <td className="auth">{authorityLabel(e, authorities)}</td>
                        <td className="dto">{delegatedToLabel(e, authorities)}</td>
                        <td>
                          <span className="codes">{codes.length ? codes.join("; ") : "—"}</span>
                        </td>
                        <td>
                          <span className={`align ${a}`} title={e.reviewNote || e.reviewStatus || ""}>
                            {ALIGN_LABEL[a]}
                          </span>
                          {a === "action" && <div className="alignwhy">{alignmentReason(e)}</div>}
                        </td>
                        <td className="go">
                          <button
                            type="button"
                            className="arrow"
                            aria-label="Open this delegation"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setDetailId(e.id);
                            }}
                          >
                            →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pager">
                <span className="muted small">
                  Showing {(start + 1).toLocaleString("en-ZA")}–{(start + slice.length).toLocaleString("en-ZA")} of{" "}
                  {sorted.length.toLocaleString("en-ZA")}
                </span>
                <div className="pgnav">
                  <button type="button" className="pg" disabled={curPage === 1} onClick={() => setPage(Math.max(1, curPage - 1))}>
                    ‹
                  </button>
                  {pageWindow(curPage, pages).map((p, i) =>
                    p === "…" ? (
                      <span key={`gap${i}`} className="gap">
                        …
                      </span>
                    ) : (
                      <button key={p} type="button" className={`pg${p === curPage ? " on" : ""}`} onClick={() => setPage(p as number)}>
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="pg"
                    disabled={curPage === pages}
                    onClick={() => setPage(Math.min(pages, curPage + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {detailEntry && (
        <DetailDrawer
          entry={detailEntry}
          org={org}
          authorities={authorities}
          onClose={() => setDetailId(null)}
          canPropose={canPropose}
        />
      )}

      {showAdd && <MandateEntryEditor orgId={org.id} authorities={authorityList} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function pageWindow(cur: number, pages: number): (number | "…")[] {
  const win: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 2) win.push(i);
    else if (win[win.length - 1] !== "…") win.push("…");
  }
  return win;
}

