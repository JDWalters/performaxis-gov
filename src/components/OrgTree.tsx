import type { AccessibleOrg } from "@/lib/data/access";
import { setScope, clearScope } from "@/app/(app)/scope-actions";

const KIND_LABEL: Record<string, string> = {
  national: "National",
  provincial: "Province",
  district: "District",
  municipality: "Municipality",
  department: "Department",
};

const KIND_TAG: Record<string, string> = {
  national: "stag-gold",
  provincial: "stag-blue",
  district: "stag-almost",
  municipality: "stag-met",
  department: "stag-okk",
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
  activeScopeOrgId,
  returnTo,
}: {
  org: AccessibleOrg;
  byParent: Map<string | null, AccessibleOrg[]>;
  depth: number;
  activeScopeOrgId: string | null;
  returnTo: string;
}) {
  const children = byParent.get(org.id) ?? [];
  const isActive = org.id === activeScopeOrgId;
  return (
    <li>
      <form action={setScope}>
        <input type="hidden" name="orgId" value={org.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className={`flex w-full items-center gap-2 rounded-md py-1.5 text-left transition hover:bg-paper ${
            isActive ? "bg-gold-bg" : ""
          }`}
          style={{ paddingLeft: depth * 18 + 6 }}
          title={`View scoped to ${org.name}`}
        >
          <span className={`stag ${KIND_TAG[org.kind] ?? "stag-pending"} text-[10px] uppercase tracking-wide`}>
            {KIND_LABEL[org.kind] ?? org.kind}
          </span>
          <span className={`text-sm font-semibold ${isActive ? "text-gold" : "text-ink"}`}>{org.name}</span>
          {org.code && <span className="text-xs text-ink2">({org.code})</span>}
          {isActive && <span className="ml-auto pr-2 text-[10px] font-bold uppercase tracking-wide text-gold">Viewing this scope</span>}
        </button>
      </form>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <OrgNode
              key={child.id}
              org={child}
              byParent={byParent}
              depth={depth + 1}
              activeScopeOrgId={activeScopeOrgId}
              returnTo={returnTo}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Renders the signed-in user's accessible org tree (their node(s) plus all
 * descendants). Every row is clickable - clicking sets that node as the
 * active "viewing scope" (see src/lib/data/scope.ts) and reloads the
 * calling page filtered down to it, at any level from national all the way
 * to a single department.
 */
export function OrgTree({
  orgs,
  activeScopeOrgId = null,
  returnTo = "/dashboard",
}: {
  orgs: AccessibleOrg[];
  activeScopeOrgId?: string | null;
  returnTo?: string;
}) {
  const byParent = buildTree(orgs);
  const orgIds = new Set(orgs.map((o) => o.id));
  // Roots = accessible orgs whose parent isn't itself in the accessible set
  // (i.e. the top of what this user can see, even if the true root is national).
  const roots = orgs.filter((o) => !o.parent_id || !orgIds.has(o.parent_id));

  if (roots.length === 0) {
    return <p className="text-sm text-ink2">No organisations linked to your account yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {activeScopeOrgId && (
        <form action={clearScope} className="self-start">
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink2 hover:border-ink hover:text-ink"
          >
            ✕ Clear scope filter — view everything
          </button>
        </form>
      )}
      <ul className="flex flex-col">
        {roots.map((root) => (
          <OrgNode
            key={root.id}
            org={root}
            byParent={byParent}
            depth={0}
            activeScopeOrgId={activeScopeOrgId}
            returnTo={returnTo}
          />
        ))}
      </ul>
    </div>
  );
}
