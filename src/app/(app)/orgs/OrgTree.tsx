import Link from "next/link";
import { KIND_LABEL, type OrgKind, type OrgNode } from "@/lib/data/orgs-shared";
import type { OrgScorecardInfo } from "@/lib/data/orgs";
import { OrgEditButton } from "./OrgEditButton";
import { ensureScorecard } from "./actions";

const KIND_TAG: Record<OrgKind, string> = {
  national: "stag-gold",
  provincial: "stag-blue",
  district: "stag-almost",
  municipality: "stag-met",
  department: "stag-okk",
  water_board: "stag-blue",
};

const LINK = "text-xs font-semibold text-blue hover:underline";

function OrgRow({
  node,
  depth,
  scorecards,
}: {
  node: OrgNode;
  depth: number;
  scorecards: Record<string, OrgScorecardInfo>;
}) {
  const sc = scorecards[node.id];
  const ownsScorecard = node.kind === "municipality" || node.kind === "department";
  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-line py-2 last:border-0"
        style={{ paddingLeft: depth * 20 }}
      >
        <span className={`stag ${KIND_TAG[node.kind]}`}>{KIND_LABEL[node.kind]}</span>
        <span className="text-sm font-semibold text-ink">{node.name}</span>
        {node.code && <span className="text-xs font-medium text-ink2">({node.code})</span>}
        {node.isMetro && <span className="stag stag-blue">Metro</span>}
        {!node.isActive && <span className="stag stag-missed">Inactive</span>}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <OrgEditButton orgId={node.id} name={node.name} code={node.code} />
          {ownsScorecard && sc?.scorecardId && (
            <Link href={`/scorecards/${sc.scorecardId}/manage`} prefetch={false} className={LINK}>
              Setup scorecard →
            </Link>
          )}
          {ownsScorecard && sc && !sc.scorecardId && (
            <form action={ensureScorecard}>
              <input type="hidden" name="orgId" value={node.id} />
              <button type="submit" className={LINK} title={`Creates the ${sc.fyLabel} scorecard`}>
                Create scorecard →
              </button>
            </form>
          )}
          {ownsScorecard && (
            <Link href={`/scorecards/kpi-library/new?org=${node.id}`} prefetch={false} className={LINK}>
              Create KPI →
            </Link>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <OrgRow key={child.id} node={child} depth={depth + 1} scorecards={scorecards} />
      ))}
    </div>
  );
}

export function OrgTree({ roots, scorecards }: { roots: OrgNode[]; scorecards: Record<string, OrgScorecardInfo> }) {
  if (roots.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-ink2">No orgs visible yet.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white px-4">
      {roots.map((root) => (
        <OrgRow key={root.id} node={root} depth={0} scorecards={scorecards} />
      ))}
    </div>
  );
}
