import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppraisalKpiLibraryEntry, getEmployeesForMunicipality } from "@/lib/data/appraisal-kpi-library";
import { EpasKpiForm } from "../EpasKpiForm";

export default async function EditEpasKpiLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getAppraisalKpiLibraryEntry(id);
  if (!entry) notFound();

  const employees = await getEmployeesForMunicipality(entry.orgId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/epas-kpi-library" className="text-xs font-semibold text-ink2 hover:underline">
          ← EPAS KPI library
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Edit indicator</h1>
      </div>
      <EpasKpiForm initial={entry} orgId={entry.orgId} employees={employees} />
    </div>
  );
}
