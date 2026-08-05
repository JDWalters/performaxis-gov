import Link from "next/link";
import { getAppraisalsList } from "@/lib/data/appraisals";

export default async function AppraisalsListPage() {
  const appraisals = await getAppraisalsList();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">EPAS Appraisals</h1>
        <p className="mt-1 text-sm text-ink2">
          Pick an employee&apos;s appraisal cycle to view or capture their quarterly KPI results.
        </p>
      </div>

      {appraisals.length === 0 ? (
        <p className="text-sm text-ink2">No appraisal cycles in view yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appraisals.map((a) => (
            <Link
              key={a.cycleId}
              href={`/appraisals/${a.cycleId}`}
              className="rounded-xl border border-line bg-white p-5 transition hover:border-gold"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-ink">{a.employeeName}</div>
                {a.needsReviewCount > 0 && (
                  <span className="flex-none rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                    {a.needsReviewCount} need review
                  </span>
                )}
              </div>
              {a.position && <div className="mt-0.5 text-xs text-ink2">{a.position}</div>}
              <div className="mt-2 flex items-center justify-between text-xs text-ink2">
                <span>{a.orgName}</span>
                <span>{a.fyLabel}</span>
              </div>
              <div className="mt-1 text-xs text-ink2">{a.kpiCount} KPIs</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
