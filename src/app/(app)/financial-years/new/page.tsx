import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActiveFinancialYear,
  canManageFinancialYears,
  suggestNextFinancialYear,
  getRolloverPreview,
} from "@/lib/data/financial-years";
import { createNewFinancialYear } from "../rollover-actions";

/**
 * "+Year" - creates a new financial year and copies every non-empty
 * department scorecard forward into it (see rollover-actions.ts for the
 * full copy semantics). Only reachable by whoever can create financial
 * years (manage_org_setup) - everyone else gets a 404, same treatment as
 * the other preview-gated setup screens in this app.
 */
export default async function NewFinancialYearPage() {
  const activeFy = await getActiveFinancialYear();
  if (!activeFy.muniOrgId) notFound();

  const allowed = await canManageFinancialYears(activeFy.muniOrgId);
  if (!allowed) notFound();

  // The outgoing year is always the most recent one on record - "+Year"
  // rolls forward from the latest year, not from whichever year the admin
  // happens to be viewing, so switching to an older year first can't be
  // used to fork a second "next year" off an already-superseded one.
  const outgoing = activeFy.years[activeFy.years.length - 1] ?? null;
  const suggestion = suggestNextFinancialYear(activeFy.years);
  const preview = outgoing ? await getRolloverPreview(outgoing.id) : [];
  const totalKpis = preview.reduce((n, p) => n + p.kpiCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/scorecards" className="text-xs font-semibold text-ink2 hover:underline">
          ← SDBIP Dashboard
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Create a new financial year</h1>
        <p className="mt-1 text-sm text-ink2">
          Copies every department&apos;s KPIs forward into a new year. Existing years are never changed.
        </p>
      </div>

      {!outgoing ? (
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          This municipality has no financial years yet - contact support to get the first one set up.
        </p>
      ) : (
        <form action={createNewFinancialYear} className="flex max-w-xl flex-col gap-5">
          <input type="hidden" name="outgoingFinancialYearId" value={outgoing.id} />

          <div className="rounded-xl border border-line bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-ink2">Rolling forward from</div>
            <div className="mt-1 text-sm font-semibold text-ink">FY {outgoing.label}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink2">Start year</span>
              <input
                type="number"
                name="startYear"
                defaultValue={suggestion.startYear}
                required
                className="rounded-md border border-line px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-ink2">Label</span>
              <input
                type="text"
                name="label"
                defaultValue={suggestion.label}
                required
                className="rounded-md border border-line px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-line bg-white p-3 text-sm">
            <input type="checkbox" name="carryTargets" defaultChecked className="mt-0.5" />
            <span>
              <span className="font-semibold text-ink">Carry forward Q1–Q4 targets</span>
              <span className="block text-xs text-ink2">
                Copies each KPI&apos;s existing quarterly targets into the new year as a starting point. Leave this
                unchecked to start the new year with blank targets instead.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-line bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-ink2">
              What will be copied ({preview.length} scorecard{preview.length === 1 ? "" : "s"}, {totalKpis} KPIs)
            </div>
            {preview.length === 0 ? (
              <p className="mt-2 text-sm text-ink2">No department has any KPIs in FY {outgoing.label} yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {preview.map((p) => (
                  <li key={p.orgId} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{p.orgName}</span>
                    <span className="text-ink2">{p.kpiCount} KPIs</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={preview.length === 0}
            className="self-start rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create FY {suggestion.label} →
          </button>
        </form>
      )}
    </div>
  );
}
