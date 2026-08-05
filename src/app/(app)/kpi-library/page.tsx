import Link from "next/link";
import { getKpiLibraryList } from "@/lib/data/kpi-library";
import { CALC_TYPES } from "@/lib/data/kpi-calc-shared";

const TYPE_LABEL = new Map<string, string>(CALC_TYPES.map((t) => [t.value, t.label]));

export default async function KpiLibraryListPage() {
  const kpis = await getKpiLibraryList();

  const byOrg = new Map<string, { orgName: string; items: typeof kpis }>();
  for (const k of kpis) {
    if (!byOrg.has(k.orgId)) byOrg.set(k.orgId, { orgName: k.orgName, items: [] });
    byOrg.get(k.orgId)!.items.push(k);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">KPI Type Generator</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            Define how each KPI is answered - Yes/No, count, ratio, formula, or rating - once,
            here. Every department&apos;s scorecard and appraisal capture form picks up the
            change automatically.
          </p>
        </div>
        <Link
          href="/kpi-library/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90"
        >
          + New KPI type
        </Link>
      </div>

      {byOrg.size === 0 ? (
        <p className="text-sm text-ink2">No KPI types defined yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byOrg.values()]
            .sort((a, b) => a.orgName.localeCompare(b.orgName))
            .map((group) => (
              <div key={group.orgName}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink2">
                  {group.orgName}
                </h2>
                <div className="overflow-hidden rounded-xl border border-line bg-white">
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
                              <span className="stag stag-blue">
                                {TYPE_LABEL.get(k.calc.type) ?? k.calc.type}
                              </span>
                            ) : (
                              <span className="text-xs text-ink2">Not set</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={`/kpi-library/${k.id}`}
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
