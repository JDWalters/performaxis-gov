import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyMemberships, getMyAccessibleOrgs, getMyProfile } from "@/lib/data/access";
import { getManageableScopes } from "@/lib/data/users";
import { getOrgManageScopes } from "@/lib/data/orgs";
import { getPolicyConfig } from "@/lib/data/policy";
import { signOut } from "./actions";

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

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 flex-none flex-col overflow-hidden bg-ink text-white">
        <div className="flex-none border-b border-white/10 px-4 py-4">
          {activeMunicipality ? (
            <>
              {muniPolicy?.muniLogoUrl ? (
                <div className="w-fit max-w-[150px] rounded-md bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external municipality-supplied URL, not a local asset */}
                  <img src={muniPolicy.muniLogoUrl} alt={activeMunicipality.name} className="max-h-[46px] max-w-full object-contain" />
                </div>
              ) : (
                <div className="mb-2.5 inline-block rounded border-[1.5px] border-gold px-2.5 py-1.5 font-mono text-xs font-semibold tracking-widest text-gold">
                  {activeMunicipality.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase()}
                </div>
              )}
              <div className="mt-2.5 text-[14.5px] font-extrabold leading-tight">{activeMunicipality.name}</div>
              <div className="mt-0.5 text-[11px] text-white/60">Management Performance Assessment</div>
            </>
          ) : (
            <>
              <div className="w-fit rounded-md bg-white p-2">
                <Image src="/performaxis-logo.svg" alt="PerformAxis" width={168} height={72} priority />
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-wide text-white/50">Government</div>
            </>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            Dashboard
          </Link>
          <Link
            href="/scorecards"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            SDBIP Scorecards
          </Link>
          <Link
            href="/progress"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            Performance Progress
          </Link>
          <Link
            href="/appraisals"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            EPAS Appraisals
          </Link>
          <Link
            href="/reports"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            Reports
          </Link>
          <Link
            href="/kpi-library"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            KPI Type Generator
          </Link>
          {canManageUsers && (
            <Link
              href="/users"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Manage Users
            </Link>
          )}
          {canManageOrgs && (
            <Link
              href="/orgs"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Org Management
            </Link>
          )}
          {canManageOrgs && (
            <Link
              href="/employees"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Employees
            </Link>
          )}
          {canManageOrgs && (
            <Link
              href="/epas-setup"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              EPAS Setup
            </Link>
          )}
        </nav>

        <div className="flex-none border-t border-white/10 p-4">
          <div className="truncate text-xs font-semibold text-white/80">
            {me.profile?.full_name || me.user.email}
          </div>
          <div className="mt-0.5 text-[11px] text-white/50">
            {memberships.length} membership{memberships.length === 1 ? "" : "s"}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2 w-full rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold text-white/90 hover:border-white/40"
            >
              Sign out
            </button>
          </form>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40">
            <span>Built by</span>
            <div className="rounded bg-white px-1 py-0.5">
              <Image src="/fridayms.png" alt="Friday Management Solutions" width={56} height={21} />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          {/* Every page under here renders its own <h1> + subtitle (the
             reference tool's pageTitle()/pageSub() pair), so this bar only
             carries global identity chrome - the reference's .whoami chip -
             not a page title. It used to say a hardcoded "Dashboard" on
             every single page, which was wrong everywhere except the actual
             dashboard. */}
          <span className="stag stag-gold">{me.profile?.full_name || me.user.email}</span>
          <div className="flex flex-wrap gap-1.5">
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
