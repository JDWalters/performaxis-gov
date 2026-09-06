import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getScorecardDetail } from "@/lib/data/scorecards";
import { canPreviewNewFeatures } from "@/lib/feature-preview";
import { ImportClient } from "./ImportClient";

export default async function ImportOfflineResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canPreviewNewFeatures(user?.email)) notFound();

  const detail = await getScorecardDetail(id, quarter);
  if (!detail) notFound();

  if (!detail.canCapture) {
    return (
      <div className="flex flex-col gap-3">
        <Link href={`/scorecards/${id}?q=${quarter}`} className="text-xs font-semibold text-ink2 hover:underline">
          ← Back to scorecard
        </Link>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You have view-only access to this scorecard, so you can&apos;t import results here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/scorecards/${id}?q=${quarter}`} className="text-xs font-semibold text-ink2 hover:underline">
          ← Back to scorecard
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Import offline results — {detail.orgName}</h1>
        <p className="mt-1 text-sm text-ink2">
          Upload or paste a JSON file saved from an offline capture form for Q{quarter}. Review each row before
          importing - nothing is written until you tick rows and click Import.
        </p>
      </div>

      <ImportClient scorecardId={detail.scorecardId} quarter={quarter} kpis={detail.kpis} />
    </div>
  );
}
