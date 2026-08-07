"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CALC_TYPES } from "@/lib/data/kpi-calc-shared";
import type { KpiLibraryItem } from "@/lib/data/kpi-library";

const TYPE_LABEL = new Map<string, string>(CALC_TYPES.map((t) => [t.value, t.label]));

/**
 * Client-side filtering for the KPI Type Generator list - by department, KPA,
 * and answer type, plus free-text search - so a policy writer with 90+ KPI
 * types defined doesn't have to scroll every department's full table to find
 * the one they're after.
 */
export function KpiLibraryFilters({ kpis }: { kpis: KpiLibraryItem[] }) {
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [kpaFilter, setKpaFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const orgs = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const k of kpis) {
      const entry = counts.get(k.orgId) ?? { name: k.orgName, count: 0 };
      entry.count++;
      counts.set(k.orgId, entry);
    }
    return [...counts.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [kpis]);

  const kpas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kpis) {
      if (!k.kpa) continue;
      counts.set(k.kpa, (counts.get(k.kpa) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [kpis]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kpis) {
      const t = k.calc?.type ?? "unset";
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [kpis]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return kpis.filter((k) => {
      if (orgFilter && k.orgId !== orgFilter) return false;
      if (kpaFilter && k.kpa !== kpaFilter) return false;
      if (typeFilter && (k.calc?.type ?? "unset") !== typeFilter) return false;
      if (!term) return true;
      return [k.name, k.kpa, k.idpRef].some((f) => f?.toLowerCase().includes(term));
    });
  }, [kpis, q, orgFilter, kpaFilter, typeFilter]);

  const byOrg = useMemo(() => {
    const map = new Map<string, { orgName: string; items: KpiLibraryItem[] }>();
    for (const k of filtered) {
      if (!map.has(k.orgId)) map.set(k.orgId, { orgName: k.orgName, items: [] });
      map.get(k.orgId)!.items.push(k);
    }
    return [...map.values()].sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [filtered]);

  const anyFilterActive = q || orgFilter || kpaFilter || typeFilter;

  return (
    <div className="flex flex-col gap-4">
      <label className="relative">
        <span className="sr-only">Search KPI types</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by KPI name, KPA, or IDP reference…"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 sm:max-w-sm"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setOrgFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            orgFilter === null ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          All departments ({kpis.length})
        </button>
        {orgs.map(([id, { name, count }]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOrgFilter(orgFilter === id ? null : id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              orgFilter === id ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            {name} ({count})
          </button>
        ))}
      </div>

      {kpas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setKpaFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              kpaFilter === null ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            All KPAs
          </button>
          {kpas.map(([kpa, count]) => (
            <button
              key={kpa}
              type="button"
              onClick={() => setKpaFilter(kpaFilter === kpa ? null : kpa)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                kpaFilter === kpa ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
              }`}
            >
              {kpa} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTypeFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            typeFilter === null ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          All answer types
        </button>
        {types.map(([t, count]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              typeFilter === t ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
            }`}
          >
            {TYPE_LABEL.get(t) ?? "Not set"} ({count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink2">
          No KPI types match{anyFilterActive ? " these filters" : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {byOrg.map((group) => (
            <div key={group.orgName}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink2">
                {group.orgName} ({group.items.length})
              </h2>
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                      <th className="px-4 py-2">KPI name</th>
                      <th className="px-4 py-2">KPA</th>
                      <th className="px-4 py-2">Answer type</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((k) => (
                      <tr key={k.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 text-ink">{k.name}</td>
                        <td className="px-4 py-2 text-ink2">{k.kpa ?? "—"}</td>
                        <td className="px-4 py-2">
                          {k.calc?.type ? (
                            <span className="stag stag-blue">{TYPE_LABEL.get(k.calc.type) ?? k.calc.type}</span>
                          ) : (
                            <span className="text-xs text-ink2">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/kpi-library/${k.id}`}
                            prefetch={false}
                            className="text-xs font-semibold text-ink2 hover:text-ink hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
