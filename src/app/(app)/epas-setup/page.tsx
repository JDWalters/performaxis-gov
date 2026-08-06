import Link from "next/link";
import { getOrgManageScopes, getFlatOrgs } from "@/lib/data/orgs";
import { getPolicyConfig } from "@/lib/data/policy";
import { getCompetencies } from "@/lib/data/competencies";
import { PolicyForm } from "./PolicyForm";
import { CompetencyEditor } from "./CompetencyEditor";

export default async function EpasSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ org }, scopes] = await Promise.all([searchParams, getOrgManageScopes()]);

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">EPAS Setup</h1>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You don&apos;t have permission to manage EPAS setup. This requires the &quot;manage_org_setup&quot;
          permission on an org - ask Friday Management Solutions or your Municipal Admin.
        </p>
      </div>
    );
  }

  const allOrgs = await getFlatOrgs();
  const municipalities = allOrgs.filter((o) => o.kind === "municipality").sort((a, b) => a.name.localeCompare(b.name));

  if (municipalities.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">EPAS Setup</h1>
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

  const [policy, competencies] = await Promise.all([
    getPolicyConfig(activeOrgId),
    getCompetencies(activeOrgId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">EPAS Setup</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            Municipality identity, assessment weighting, bonus bands, and the competency framework - one
            configuration per municipality, used across every employee&apos;s performance agreement and
            assessment.
          </p>
        </div>
        {municipalities.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {municipalities.map((m) => (
              <Link
                key={m.id}
                href={`/epas-setup?org=${m.id}`}
                className={`stag ${m.id === activeOrgId ? "stag-blue" : "stag-pending"}`}
              >
                {m.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs font-bold uppercase tracking-wide text-ink2">{activeOrgName}</div>

      <PolicyForm orgId={activeOrgId} policy={policy} />
      <CompetencyEditor orgId={activeOrgId} competencies={competencies} />
    </div>
  );
}
