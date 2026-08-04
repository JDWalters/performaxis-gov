import type { AccessibleOrg } from "@/lib/data/access";

const KIND_LABEL: Record<string, string> = {
  national: "National",
  provincial: "Province",
  district: "District",
  municipality: "Municipality",
  department: "Department",
};

function buildTree(orgs: AccessibleOrg[]) {
  const byParent = new Map<string | null, AccessibleOrg[]>();
  for (const org of orgs) {
    const key = org.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(org);
  }
  return byParent;
}

function OrgNode({
  org,
  byParent,
  depth,
}: {
  org: AccessibleOrg;
  byParent: Map<string | null, AccessibleOrg[]>;
  depth: number;
}) {
  const children = byParent.get(org.id) ?? [];
  return (
    <li>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
        <span className="stag stag-pending text-[10px] uppercase tracking-wide">
          {KIND_LABEL[org.kind] ?? org.kind}
        </span>
        <span className="text-sm font-semibold text-ink">{org.name}</span>
        {org.code && <span className="text-xs text-ink2">({org.code})</span>}
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <OrgNode key={child.id} org={child} byParent={byParent} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Renders the signed-in user's accessible org tree (their node(s) plus all descendants). */
export function OrgTree({ orgs }: { orgs: AccessibleOrg[] }) {
  const byParent = buildTree(orgs);
  const orgIds = new Set(orgs.map((o) => o.id));
  // Roots = accessible orgs whose parent isn't itself in the accessible set
  // (i.e. the top of what this user can see, even if the true root is national).
  const roots = orgs.filter((o) => !o.parent_id || !orgIds.has(o.parent_id));

  if (roots.length === 0) {
    return <p className="text-sm text-ink2">No organisations linked to your account yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {roots.map((root) => (
        <OrgNode key={root.id} org={root} byParent={byParent} depth={0} />
      ))}
    </ul>
  );
}
