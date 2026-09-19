import { getActiveScope } from "@/lib/data/scope";
import { clearScope } from "@/app/(app)/scope-actions";

/**
 * SDBIP's slice of the reports hub - the reference tool's pageReports()
 * scorecard-export section (full ZIP of every accessible scorecard's
 * register + Q1-Q4 reports, plus the printable annual Top Layer report).
 * Split out from the old shared /reports page so this route lives
 * unambiguously under /scorecards and the sidebar never has to guess which
 * section it belongs to - see src/components/Sidebar.tsx detectSection().
 */
export default async function ScorecardsReportsPage() {
  const scope = await getActiveScope();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-ink2">
          Export or print SDBIP scorecard documents.
        </p>
      </div>

      {scope && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gold/40 bg-gold-bg px-3 py-2 text-sm font-semibold text-ink">
          <span>
            Viewing scope: <span className="text-gold">{scope.org.name}</span> and everything under it
          </span>
          <form action={clearScope}>
            <input type="hidden" name="returnTo" value="/scorecards/reports" />
            <button type="submit" className="ml-1 text-xs font-bold text-ink2 underline hover:text-ink">
              Clear
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="mb-1 text-sm font-extrabold text-ink">SDBIP scorecards</h2>
        <p className="mb-3 text-xs text-ink2">
          Every accessible scorecard&apos;s full-year register plus Q1-Q4 report CSVs, bundled as one ZIP - one
          folder per department. Individual scorecard exports are available from each scorecard&apos;s page.
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Plain <a>, not next/link - this is a Route Handler that streams
             a file download, not a page to client-navigate to. Template
             literal href for the same reason as the CSV export link above. */}
          <a
            href={`/scorecards/reports/scorecards-zip`}
            className="inline-block rounded-md border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-gold hover:text-ink"
          >
            Export ALL scorecards (ZIP) ↓
          </a>
          <a
            href="/scorecards/report?sc=top&period=annual"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-gold hover:text-ink"
          >
            Print annual SDBIP report ↗
          </a>
        </div>
      </div>
    </div>
  );
}
