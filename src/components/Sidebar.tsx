"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/(app)/actions";

export const SIDEBAR_COLLAPSE_COOKIE = "px_sidebar_collapsed";
export const SIDEBAR_SECTIONS_COOKIE = "px_sidebar_sections";

type NavItem = { href: string; icon: string; label: string };
type NavSection = { id: string; label: string; items: NavItem[] };

/** Icons mirror the reference tool's .navico glyphs where a direct equivalent
 * exists (Dashboard/Progress/Reports/library/setup all match literally); the
 * two items with no single-tenant reference equivalent (this app merges two
 * products plus adds multi-tenant admin screens) get a same-weight Unicode
 * dingbat in the same style rather than an emoji, to keep the sidebar
 * visually flat. */
const DASHBOARD_ITEM: NavItem = { href: "/dashboard", icon: "◴", label: "Dashboard" };

// Reports covers both products (org-wide summary + CSV export are EPAS data,
// the scorecards ZIP export is SDBIP data), so it's deliberately listed
// under both sections rather than picking one home for it.
const REPORTS_ITEM: NavItem = { href: "/reports", icon: "␙", label: "Reports" };

// KPI setup lives under each product's own section now (previously both
// sat under SETUP) - PerformAxis is unifying three of the client's separate
// legacy tools (SDBIP/EPAS/MANDATE) into one system, so each product's
// admin screens belong with that product, not lumped into a shared catch-all.
const SDBIP_NAV: NavItem[] = [
  { href: "/scorecards", icon: "▦", label: "SDBIP Scorecards" },
  { href: "/progress", icon: "↗", label: "Performance Progress" },
  { href: "/kpi-library", icon: "≡", label: "KPI Type Generator" },
  REPORTS_ITEM,
];
const EPAS_NAV: NavItem[] = [
  { href: "/appraisals", icon: "✓", label: "EPAS Appraisals" },
  { href: "/epas-kpi-library", icon: "☰", label: "KPI setup" },
  REPORTS_ITEM,
];
// The delegation-of-powers register, folded in from the client's standalone
// Mandate app - more screens (governance workspace, posts/bodies,
// instruments, decision log, reports) land here as they're built.
const MANDATE_NAV: NavItem[] = [
  { href: "/mandate", icon: "◆", label: "Delegations" },
  { href: "/mandate/authority", icon: "◆", label: "Who may do what" },
  { href: "/mandate/instruments", icon: "◆", label: "Instruments" },
  { href: "/mandate/decisions", icon: "◆", label: "Decision log" },
  { href: "/mandate/reports", icon: "◆", label: "Reports" },
  { href: "/mandate/governance", icon: "◆", label: "Governance" },
  { href: "/mandate/admin/structure", icon: "◆", label: "Posts and bodies" },
  { href: "/mandate/admin/library", icon: "◆", label: "By-law library" },
];

// Setup order, not alphabetical: orgs must exist before employees can be
// added to them, employees before EPAS policy/competencies mean anything,
// and inviting users is naturally the last step.
const SETUP_NAV_BASE: NavItem[] = [];
const ORG_ADMIN_NAV: NavItem[] = [
  { href: "/orgs", icon: "⌂", label: "Org Management" },
  { href: "/employees", icon: "☺", label: "Employees" },
  { href: "/epas-setup", icon: "⚙", label: "EPAS Setup" },
];
const USER_ADMIN_NAV: NavItem[] = [{ href: "/users", icon: "☷", label: "Manage Users" }];

// Sections collapsed by default (before any cookie override).
export const DEFAULT_COLLAPSED_SECTIONS: string[] = [];

// Defined at module scope (rather than inline in the toggle handler) so the
// write is a plain function call from the component, not a bare
// `document.cookie = ...` statement inside it.
function writeSectionsCookie(ids: string[]) {
  document.cookie = `${SIDEBAR_SECTIONS_COOKIE}=${encodeURIComponent(JSON.stringify(ids))}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/** Chevron + label header that toggles a section's items open/closed - hidden entirely in the icon-only rail (nothing to collapse when there are no labels to hide). */
function SectionHeader({
  label,
  open,
  empty,
  onToggle,
}: {
  label: string;
  open: boolean;
  empty: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mt-3 flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide hover:text-white/70 max-[900px]:hidden ${
        empty ? "text-white/25" : "text-white/40"
      }`}
    >
      <span className={`inline-block w-2.5 flex-none text-center text-[9px] transition-transform ${open ? "rotate-90" : ""}`}>
        ▸
      </span>
      {label}
    </button>
  );
}

function NavLink({ href, icon, label, collapsed }: NavItem & { collapsed: boolean }) {
  return (
    <Link
      href={href}
      // Every route under here is fully dynamic (per-request Supabase reads
      // behind RLS, no static shell) - Next's default hover/viewport prefetch
      // was firing a full server render of every OTHER sidebar link's page
      // on every single page load (confirmed via network timing: ~8 background
      // RSC fetches, 500-1200ms each, on every dashboard visit). That's dead
      // weight competing for the same DB connections as the page the user
      // actually asked for, which is the main thing making navigation feel
      // sluggish. A real click still fetches instantly - it just does it on
      // demand instead of speculatively for every link on screen.
      prefetch={false}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 rounded-md py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white max-[900px]:px-2.5 max-[900px]:py-1.5 max-[900px]:text-xs ${
        collapsed ? "justify-center px-2" : "px-3"
      }`}
    >
      <span className="w-[22px] flex-none text-center text-[17px] opacity-90">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar({
  activeMunicipality,
  userName,
  membershipCount,
  canManageUsers,
  canManageOrgs,
  initialCollapsed,
  initialCollapsedSections,
}: {
  activeMunicipality: { name: string; logoUrl: string | null } | null;
  userName: string;
  membershipCount: number;
  canManageUsers: boolean;
  canManageOrgs: boolean;
  initialCollapsed: boolean;
  initialCollapsedSections: string[];
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [collapsedSections, setCollapsedSections] = useState<string[]>(initialCollapsedSections);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Mirrors the org-scope cookie pattern (src/lib/data/scope.ts) - written
    // directly here rather than via a server action so the toggle is
    // instant and doesn't trigger a full page data refetch for a pure UI
    // preference. Read back server-side on next load to avoid a flash.
    document.cookie = `${SIDEBAR_COLLAPSE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }

  function toggleSection(id: string) {
    const nextIds = collapsedSections.includes(id)
      ? collapsedSections.filter((existing) => existing !== id)
      : [...collapsedSections, id];
    setCollapsedSections(nextIds);
    writeSectionsCookie(nextIds);
  }

  const setupItems: NavItem[] = [
    ...SETUP_NAV_BASE,
    ...(canManageOrgs ? ORG_ADMIN_NAV : []),
    ...(canManageUsers ? USER_ADMIN_NAV : []),
  ];
  const sections: NavSection[] = [
    { id: "sdbip", label: "SDBIP", items: SDBIP_NAV },
    { id: "epas", label: "EPAS", items: EPAS_NAV },
    { id: "mandate", label: "MANDATE", items: MANDATE_NAV },
    { id: "setup", label: "SETUP", items: setupItems },
  ];
  // The icon-only rail has no room for section headers, so it falls back to
  // one flat, deduplicated list (Reports would otherwise show up twice,
  // once from SDBIP and once from EPAS).
  const flatUnique: NavItem[] = [];
  const seenHrefs = new Set<string>();
  for (const item of [DASHBOARD_ITEM, ...sections.flatMap((s) => s.items)]) {
    if (seenHrefs.has(item.href)) continue;
    seenHrefs.add(item.href);
    flatUnique.push(item);
  }

  const crestInitials = activeMunicipality
    ? activeMunicipality.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase()
    : "";

  return (
    <aside
      // The reference tool turns this same rail into a wrapping horizontal
      // toolbar at <=900px (position:static, flex-direction:row, flex-wrap)
      // instead of a vertical rail with its own scroll - ported literally
      // rather than reinvented, since it's the one screen-shape decision the
      // source already made for us.
      className={`sticky top-0 flex h-screen flex-none flex-col overflow-hidden bg-ink text-white transition-[width] duration-150 max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:items-center max-[900px]:gap-2 max-[900px]:overflow-visible max-[900px]:p-2.5 ${
        collapsed ? "w-[64px]" : "w-60"
      }`}
    >
      <div
        className={`flex-none border-b border-white/10 py-4 max-[900px]:flex max-[900px]:items-center max-[900px]:gap-2 max-[900px]:border-0 max-[900px]:px-0 max-[900px]:py-0 ${collapsed ? "px-2" : "px-4"}`}
      >
        {activeMunicipality ? (
          collapsed ? (
            activeMunicipality.logoUrl ? (
              <div className="w-fit rounded-md bg-white p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- external municipality-supplied URL, not a local asset */}
                <img src={activeMunicipality.logoUrl} alt={activeMunicipality.name} className="h-8 w-8 object-contain" />
              </div>
            ) : (
              <div
                title={activeMunicipality.name}
                className="flex h-8 w-8 items-center justify-center rounded border-[1.5px] border-gold font-mono text-[9px] font-semibold tracking-wide text-gold"
              >
                {crestInitials}
              </div>
            )
          ) : (
            <>
              {activeMunicipality.logoUrl ? (
                <div className="w-fit max-w-[150px] rounded-md bg-white p-1.5 max-[900px]:max-w-none max-[900px]:p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external municipality-supplied URL, not a local asset */}
                  <img
                    src={activeMunicipality.logoUrl}
                    alt={activeMunicipality.name}
                    className="max-h-[46px] max-w-full object-contain max-[900px]:max-h-8"
                  />
                </div>
              ) : (
                <div className="mb-2.5 inline-block rounded border-[1.5px] border-gold px-2.5 py-1.5 font-mono text-xs font-semibold tracking-widest text-gold max-[900px]:mb-0">
                  {crestInitials}
                </div>
              )}
              <div className="mt-2.5 truncate text-[14.5px] font-extrabold leading-tight max-[900px]:hidden">
                {activeMunicipality.name}
              </div>
              <div className="mt-0.5 text-[11px] text-white/60 max-[900px]:hidden">Management Performance Assessment</div>
            </>
          )
        ) : collapsed ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white">
            <Image src="/performaxis-logo.svg" alt="PerformAxis" width={26} height={26} />
          </div>
        ) : (
          <>
            <div className="w-fit rounded-md bg-white p-2 max-[900px]:p-1">
              <Image
                src="/performaxis-logo.svg"
                alt="PerformAxis"
                width={168}
                height={72}
                priority
                className="max-[900px]:h-8 max-[900px]:w-auto"
              />
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-wide text-white/50 max-[900px]:hidden">Government</div>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 max-[900px]:flex-none max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:items-center max-[900px]:gap-1.5 max-[900px]:overflow-visible max-[900px]:p-0">
        <NavLink {...DASHBOARD_ITEM} collapsed={collapsed} />

        {collapsed ? (
          // Icon rail: no room for section labels, so every item (deduplicated
          // across sections) renders flat, with a single divider standing in
          // for all the section breaks below.
          <>
            <div className="my-2 border-t border-white/10 max-[900px]:my-0 max-[900px]:h-6 max-[900px]:w-px max-[900px]:border-t-0 max-[900px]:border-l" />
            {flatUnique
              .filter((item) => item.href !== DASHBOARD_ITEM.href)
              .map((item) => (
                <NavLink key={item.href} {...item} collapsed={collapsed} />
              ))}
          </>
        ) : (
          sections.map((section) => {
            const empty = section.items.length === 0;
            const open = !collapsedSections.includes(section.id);
            return (
              <div key={section.id} className="max-[900px]:contents">
                <SectionHeader
                  label={section.label}
                  open={open}
                  empty={empty}
                  onToggle={() => toggleSection(section.id)}
                />
                {open &&
                  (empty ? (
                    <div className="px-3 py-1 text-xs italic text-white/30 max-[900px]:hidden">Coming soon</div>
                  ) : (
                    section.items.map((item) => <NavLink key={item.href} {...item} collapsed={collapsed} />)
                  ))}
              </div>
            );
          })
        )}
      </nav>

      <div
        className={`flex-none border-t border-white/10 py-4 max-[900px]:border-0 max-[900px]:px-0 max-[900px]:py-0 ${collapsed ? "px-2" : "px-4"}`}
      >
        {!collapsed && (
          <>
            <div className="truncate text-xs font-semibold text-white/80 max-[900px]:hidden">{userName}</div>
            <div className="mt-0.5 text-[11px] text-white/50 max-[900px]:hidden">
              {membershipCount} membership{membershipCount === 1 ? "" : "s"}
            </div>
          </>
        )}
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className={`mt-2 rounded-md border border-white/20 text-xs font-bold text-white/90 hover:border-white/40 max-[900px]:mt-0 max-[900px]:flex max-[900px]:h-8 max-[900px]:w-8 max-[900px]:items-center max-[900px]:justify-center max-[900px]:px-0 max-[900px]:py-0 ${
              collapsed ? "flex h-8 w-8 items-center justify-center" : "w-full px-3 py-1.5"
            }`}
          >
            <span className="max-[900px]:hidden">{collapsed ? "⏻" : "Sign out"}</span>
            <span className="hidden max-[900px]:inline">⏻</span>
          </button>
        </form>
        {!collapsed && (
          <div className="mt-3 w-fit rounded bg-white px-1.5 py-1 max-[900px]:hidden">
            <Image src="/fridayms.png" alt="Friday Management Solutions" width={90} height={34} />
          </div>
        )}
      </div>

      <div className={`flex-none border-t border-white/10 py-2 max-[900px]:hidden ${collapsed ? "px-1" : "px-2"}`}>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2.5 rounded-md py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white ${
            collapsed ? "w-full justify-center px-2" : "w-full px-3"
          }`}
        >
          <span className="w-[22px] flex-none text-center text-[17px]">{collapsed ? "›" : "‹"}</span>
          {!collapsed && <span>Collapse sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
