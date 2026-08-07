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
    <div className="flex min-h-screen max-[900px]:flex-col">
      <Sidebar
        activeMunicipality={activeMunicipality ? { name: activeMunicipality.name, logoUrl: muniPolicy?.muniLogoUrl ?? null } : null}
        userName={me.profile?.full_name || me.user.email || "—"}
        membershipCount={memberships.length}
        canManageUsers={canManageUsers}
        canManageOrgs={canManageOrgs}
        initialCollapsed={initialCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-6 py-3 max-[900px]:px-4 max-[900px]:py-2.5">
          {/* Every page under here renders its own <h1> + subtitle (the
             reference tool's pageTitle()/pageSub() pair), so this bar only
             carries global identity chrome - the reference's .whoami chip -
             not a page title. It used to say a hardcoded "Dashboard" on
             every single page, which was wrong everywhere except the actual
             dashboard. The PerformAxis mark anchors the left edge (the one
             other place, besides the footer, the vendor's own brand shows
             through); the signed-in user's chip now sits with the role
             chips on the right instead of standing alone on the left. */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
              <Image
                src="/performaxis-logo.svg"
                alt=""
                fill
                style={{ objectFit: "cover", objectPosition: "left" }}
              />
            </div>
            {/* The logo file's own baked-in wordmark reads fine at the sidebar's
               large size but turns to an illegible smear at header scale, so
               the name here is real text set in the same two brand colours
               instead of a shrunk copy of the SVG type. */}
            <span className="text-[15px] font-extrabold tracking-tight">
              <span className="text-ink">Perform</span>
              <span className="text-gold">Axis</span>
            </span>
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
        <main className="flex-1 overflow-x-hidden bg-paper p-6 max-[900px]:p-4">{children}</main>
      </div>
    </div>
  );
}
