import Link from "next/link";
import { getKpiLibraryList } from "@/lib/data/kpi-library";
import { KpiLibraryFilters } from "./KpiLibraryFilters";

export default async function KpiLibraryListPage() {
  const kpis = await getKpiLibraryList();

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

      {kpis.length === 0 ? (
        <p className="text-sm text-ink2">No KPI types defined yet.</p>
      ) : (
        <KpiLibraryFilters kpis={kpis} />
      )}
    </div>
  );
}
