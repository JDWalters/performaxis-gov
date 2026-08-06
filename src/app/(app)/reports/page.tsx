import Link from "next/link";
import { getAppraisalsList } from "@/lib/data/appraisals";

/**
 * The reference tool's pageReports() - print/export cards per employee cycle
 * (agreement, quarterly/panel assessment, annual summary, PDP), plus an
 * organisation-wide summary and a full CSV export. Every link opens the
 * corresponding (print) route in a new tab, exactly like the reference's
 * "Open" buttons.
 */
export default async function ReportsPage() {
  const appraisals = await getAppraisalsList();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-ink2">
          Print or save appraisal documents. Each opens in a new tab ready to print or save as PDF.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="mb-1 text-sm font-extrabold text-ink">Organisation-wide</h2>
        <p className="mb-3 text-xs text-ink2">
          All employees in view, with their scores for the selected quarter - for the panel or Council.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4].map((q) => (
            <a
              key={q}
              href={`/reports/org-summary?q=${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-gold hover:text-ink"
            >
              Q{q} organisational summary ↗
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="mb-1 text-sm font-extrabold text-ink">Data export</h2>
        <p className="mb-3 text-xs text-ink2">
          A CSV of every accessible employee&apos;s indicators, targets, ratings and N/A flags - useful as a backup
          or for the auditors.
        </p>
        <a
          href="/reports/csv"
          className="inline-block rounded-md border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-gold hover:text-ink"
        >
          Export CSV ↓
        </a>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-extrabold text-ink">Per-employee documents</h2>
        {appraisals.length === 0 ? (
          <p className="text-sm text-ink2">No appraisal cycles in view yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appraisals.map((a) => (
              <div key={a.cycleId} className="rounded-xl border border-line bg-white p-4">
                <div className="text-sm font-semibold text-ink">{a.employeeName}</div>
                {a.position && <div className="mt-0.5 text-xs text-ink2">{a.position}</div>}
                <div className="mt-1 text-xs text-ink2">
                  {a.orgName} · {a.fyLabel}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <a
                    href={`/appraisals/${a.cycleId}/agreement`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink"
                  >
                    Agreement ↗
                  </a>
                  <a
                    href={`/appraisals/${a.cycleId}/assessment?q=4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink"
                  >
                    Assessment ↗
                  </a>
                  <a
                    href={`/appraisals/${a.cycleId}/annual`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink"
                  >
                    Annual summary ↗
                  </a>
                  <a
                    href={`/appraisals/${a.cycleId}/pdp`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink"
                  >
                    PDP ↗
                  </a>
                  <Link
                    href={`/appraisals/${a.cycleId}`}
                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink2 hover:border-gold hover:text-ink"
                  >
                    Open cycle
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
