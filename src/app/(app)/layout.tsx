import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyMemberships, getMyProfile } from "@/lib/data/access";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMyProfile();
  if (!me?.user) redirect("/login");

  const memberships = await getMyMemberships();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-none flex-col bg-ink text-white">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="text-base font-extrabold tracking-tight">
            Perform<span className="text-gold">Axis</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-white/50">
            Government
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
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
            href="/appraisals"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            EPAS Appraisals
          </Link>
          <Link
            href="/kpi-library"
            className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            KPI Type Generator
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4">
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <h1 className="text-lg font-extrabold text-ink">Dashboard</h1>
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
