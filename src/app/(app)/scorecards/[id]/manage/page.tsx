import Link from "next/link";
import { notFound } from "next/navigation";
import { getScorecardDetail } from "@/lib/data/scorecards";
import { getKpiLibraryList } from "@/lib/data/kpi-library";
import { getMunicipalityOrgId, getCircular88Catalogue } from "@/lib/data/circular88";
import { ManageKpisClient } from "./ManageKpisClient";

export default async function ManageKpisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) notFound();

  if (!detail.canManageSetup) {
    return (
      <div className="flex flex-col gap-3">
        <Link href={`/scorecards/${id}?q=${quarter}`} className="text-xs font-semibold text-ink2 hover:underline">
          ← Back to scorecard
        </Link>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You don&apos;t have permission to manage this scorecard&apos;s KPI list.
        </p>
      </div>
    );
  }

  const allLibrary = await getKpiLibraryList();
  const available = allLibrary
    .filter((k) => k.orgId === detail.orgId)
    .map((k) => ({
      id: k.id,
      name: k.name,
      kpa: k.kpa,
      unitOfMeasure: k.unitOfMeasure,
      targetType: k.targetType,
      alreadyOnScorecard: detail.kpis.some((existing) => existing.libraryId === k.id),
    }));

  const municipalityOrgId = await getMunicipalityOrgId(detail.orgId);
  const catalogue = await getCircular88Catalogue(municipalityOrgId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/scorecards/${id}?q=${quarter}`} className="text-xs font-semibold text-ink2 hover:underline">
          ← Back to scorecard
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Scorecard Setup — {detail.orgName}</h1>
        <p className="mt-1 text-sm text-ink2">
          Add or remove KPIs, and edit each one&apos;s capture setup - answer type, results across quarters
          (accumulation), and the method/type/wards/baseline/target/POE fields shown on the register. Deleting a KPI
          also removes all of its captured targets and results - this can&apos;t be undone.
        </p>
      </div>

      <ManageKpisClient
        scorecardId={detail.scorecardId}
        departmentOrgId={detail.orgId}
        currentKpis={detail.kpis.map((k) => ({
          id: k.id,
          refCode: k.refCode,
          name: k.name,
          kpa: k.kpa,
          c88Code: k.c88Code,
          calc: k.calc,
          lower: k.lower,
          acc: k.acc,
          method: k.method,
          kpiType: k.kpiType,
          wards: k.wards,
          baseline: k.baseline,
          annualTarget: k.annualTarget,
          poe: k.poe,
        }))}
        availableLibrary={available}
        circular88Catalogue={catalogue}
      />
    </div>
  );
}
