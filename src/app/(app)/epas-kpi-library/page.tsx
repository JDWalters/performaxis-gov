import Link from "next/link";
import { getMyMunicipalityOrgs, getActiveFinancialYear } from "@/lib/data/financial-years";
import { getAppraisalKpiLibraryList, getEmployeesForMunicipality } from "@/lib/data/appraisal-kpi-library";
import { EpasKpiLibraryTable } from "./EpasKpiLibraryTable";

export default async function EpasKpiLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ org }, municipalities, activeFy] = await Promise.all([
    searchParams,
    getMyMunicipalityOrgs(),
    getActiveFinancialYear(),
  ]);

  if (municipalities.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">EPAS KPI library</h1>
        <p className="text-sm text-ink2">
          No municipality is set up yet. Create one first in{" "}
          <Link href="/orgs" className="font-semibold text-blue hover:underline">
            Org Management
          </Link>
          .
        </p>
      </div>
    );
  }

  const activeOrgId = municipalities.find((m) => m.id === org)?.id ?? municipalities[0].id;
  const activeOrgName = municipalities.find((m) => m.id === activeOrgId)?.name ?? "";

  const [kpis, employees] = await Promise.all([
    getAppraisalKpiLibraryList(activeOrgId),
    getEmployeesForMunicipality(activeOrgId),
  ]);

  // The topbar FY switcher only resolves a year for the signed-in user's
  // first municipality (see getActiveFinancialYear) - if this page is
  // showing a different municipality's library, there's no reliable "add to
  // plan" target year, so that action is disabled rather than guessed.
  const financialYearId = activeFy.muniOrgId === activeOrgId ? activeFy.selected?.id ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">EPAS KPI library</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            A shared bank of performance indicators for {activeOrgName || "this municipality"}. Add
            them to any employee&apos;s Annexure A performance plan instead of typing each one by
            hand.
          </p>
        </div>
        <Link
          href={`/epas-kpi-library/new?org=${activeOrgId}`}
          className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90"
        >
          + Create a KPI
        </Link>
      </div>

      {municipalities.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {municipalities.map((m) => (
            <Link
              key={m.id}
              href={`/epas-kpi-library?org=${m.id}`}
              className={`stag ${m.id === activeOrgId ? "stag-blue" : "stag-pending"}`}
            >
              {m.name}
            </Link>
          ))}
        </div>
      )}

      <EpasKpiLibraryTable orgId={activeOrgId} kpis={kpis} employees={employees} financialYearId={financialYearId} />
    </div>
  );
}
