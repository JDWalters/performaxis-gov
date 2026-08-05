import Link from "next/link";
import { getDepartmentOrgs, getDistinctKpas } from "@/lib/data/kpi-library";
import { KpiTypeForm } from "../KpiTypeForm";

export default async function NewKpiLibraryPage() {
  const [departments, kpas] = await Promise.all([getDepartmentOrgs(), getDistinctKpas()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/kpi-library" className="text-xs font-semibold text-ink2 hover:underline">
          ← KPI Type Generator
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">New KPI type</h1>
      </div>
      <KpiTypeForm initial={null} departments={departments} kpas={kpas} />
    </div>
  );
}
