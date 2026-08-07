import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getMyMemberships, getMyAccessibleOrgs, getMyProfile } from "@/lib/data/access";
import { getManageableScopes } from "@/lib/data/users";
import { getOrgManageScopes } from "@/lib/data/orgs";
import { getPolicyConfig } from "@/lib/data/policy";
import { Sidebar, SIDEBAR_COLLAPSE_COOKIE } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMyProfile();
  if (!me?.user) redirect("/login");

  // Both scope checks only decide whether to show one nav link each - a bug
  // in either should never be able to take down every page in the app, so
  // any failure here just hides the link instead of crashing the layout.
  const [memberships, manageableScopes, orgManageScopes, accessibleOrgs] = await Promise.all([
    getMyMemberships(),
    getManageableScopes().catch(() => []),
    getOrgManageScopes().catch(() => []),
    getMyAccessibleOrgs().catch(() => []),
  ]);
  const canManageUsers = manageableScopes.length > 0;
  const canManageOrgs = orgManageScopes.length > 0;

  // The reference tool's sidebar identifies the municipality it's running
  // for (crest/logo + name + "Management Performance Assessment"), not the
  // vendor's own product mark - PerformAxis branding only surfaces once, in
  // the footer, matching the reference's Friday Management Solutions
  // "owner" mark. A Platform Admin who can see more than one municipality
  // has no single one to brand the shell with, so that case (and brand-new
  // users with no municipality yet) falls back to the product mark instead.
  const municipalities = accessibleOrgs.filter((o) => o.kind === "municipality");
  const activeMunicipality = municipalities.length === 1 ? municipalities[0] : null;
  const muniPolicy = activeMunicipality ? await getPolicyConfig(activeMunicipality.id).catch(() => null) : null;

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSE_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeMunicipality={activeMunicipality ? { name: activeMunicipality.name, logoUrl: muniPolicy?.muniLogoUrl ?? null } : null}
        userName={me.profile?.full_name || me.user.email || "—"}
        membershipCount={memberships.length}
        canManageUsers={canManageUsers}
        canManageOrgs={canManageOrgs}
        initialCollapsed={initialCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          {/* Every page under here renders its own <h1> + subtitle (the
             reference tool's pageTitle()/pageSub() pair), so this bar only
             carries global identity chrome - the reference's .whoami chip -
             not a page title. It used to say a hardcoded "Dashboard" on
             every single page, which was wrong everywhere except the actual
             dashboard. The PerformAxis mark anchors the left edge (the one
             other place, besides the footer, the vendor's own brand shows
             through); the signed-in user's chip now sits with the role
             chips on the right instead of standing alone on the left. */}
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
            <Image
              src="/performaxis-logo.svg"
              alt="PerformAxis"
              fill
              style={{ objectFit: "cover", objectPosition: "left" }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="stag stag-gold">{me.profile?.full_name || me.user.email}</span>
            {memberships.map((m) => (
              <span key={m.membership_id} className="stag stag-blue">
                {m.role_name} · {m.org_name}
              </span>
            ))}
          </div>
        </header>
        <main className="flex-1 bg-paper p-6">{children}</main>
      </div>
    </div>
  );
}
