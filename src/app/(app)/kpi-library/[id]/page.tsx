import Link from "next/link";
import { notFound } from "next/navigation";
import { getDepartmentOrgs, getDistinctKpas, getKpiLibraryEntry } from "@/lib/data/kpi-library";
import { canPreviewNewFeatures } from "@/lib/feature-preview";
import { getMyProfile } from "@/lib/data/access";
import { KpiTypeForm } from "../KpiTypeForm";

export default async function EditKpiLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, departments, kpas, me] = await Promise.all([
    getKpiLibraryEntry(id),
    getDepartmentOrgs(),
    getDistinctKpas(),
    getMyProfile(),
  ]);
  if (!entry) notFound();
  const showScorecardSetupFields = canPreviewNewFeatures(me?.profile?.full_name);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/kpi-library" className="text-xs font-semibold text-ink2 hover:underline">
          ← KPI Type Generator
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">{entry.name}</h1>
      </div>
      <KpiTypeForm
        initial={entry}
        departments={departments}
        kpas={kpas}
        showScorecardSetupFields={showScorecardSetupFields}
      />
    </div>
  );
}
