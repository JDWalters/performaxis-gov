import Link from "next/link";
import { KIND_LABEL, type OrgKind, type OrgNode } from "@/lib/data/orgs-shared";

const KIND_TAG: Record<OrgKind, string> = {
  national: "stag-gold",
  provincial: "stag-blue",
  district: "stag-almost",
  municipality: "stag-met",
  department: "stag-okk",
};

function OrgRow({ node, depth }: { node: OrgNode; depth: number }) {
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
        {node.kind === "department" && (
          <Link
            href={`/kpi-library/new?org=${node.id}`}
            prefetch={false}
            className="ml-auto text-xs font-semibold text-blue hover:underline"
          >
            Create KPI →
          </Link>
        )}
      </div>
      {node.children.map((child) => (
        <OrgRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function OrgTree({ roots }: { roots: OrgNode[] }) {
  if (roots.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-ink2">No orgs visible yet.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white px-4">
      {roots.map((root) => (
        <OrgRow key={root.id} node={root} depth={0} />
      ))}
    </div>
  );
}
