import Link from "next/link";
import { getMyMunicipalityOrgs } from "@/lib/data/financial-years";
import { getEmployeesForMunicipality } from "@/lib/data/appraisal-kpi-library";
import { EpasKpiForm } from "../EpasKpiForm";

export default async function NewEpasKpiLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const municipalities = await getMyMunicipalityOrgs();
  const orgId = municipalities.find((m) => m.id === org)?.id ?? municipalities[0]?.id ?? "";
  const employees = orgId ? await getEmployeesForMunicipality(orgId) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/epas-kpi-library" className="text-xs font-semibold text-ink2 hover:underline">
          ← EPAS KPI library
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Create a KPI</h1>
      </div>
      <EpasKpiForm initial={null} orgId={orgId} employees={employees} />
    </div>
  );
}
