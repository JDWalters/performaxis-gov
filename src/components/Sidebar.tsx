"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/(app)/actions";

export const SIDEBAR_COLLAPSE_COOKIE = "px_sidebar_collapsed";
export const SIDEBAR_SECTIONS_COOKIE = "px_sidebar_sections";

type NavItem = { href: string; icon: string; label: string };
type NavSection = { id: string; label: string; items: NavItem[] };
export type SectionId = "sdbip" | "epas" | "mandate";

/** Icons mirror the reference tool's .navico glyphs where a direct equivalent
 * exists (Dashboard/Progress/Reports/library/setup all match literally); the
 * items with no single-tenant reference equivalent (this app merges three
 * products plus adds multi-tenant admin screens) get a same-weight Unicode
 * dingbat in the same style rather than an emoji, to keep the sidebar
 * visually flat. */
const SYSTEM_HUB_ITEM: NavItem = { href: "/dashboard", icon: "⌖", label: "System Hub" };

// Reports now lives as a genuinely separate page per section
// (/appraisals/reports for EPAS, /scorecards/reports for SDBIP) - each
// section's nav points at its own copy rather than sharing one ambiguous
// /reports route. See appraisals/reports/page.tsx and
// scorecards/reports/page.tsx.

// Order follows the client's own stated list verbatim: Dashboard first (it's
// the section's landing view), then the day-to-day capture/progress/reports
// flow, then the two setup screens last within the main list (Organisation
// Setup is a *separate*, pinned-bottom item - see getPinnedBottomItems -
// so it isn't duplicated up here).
const SDBIP_NAV: NavItem[] = [
  { href: "/scorecards/dashboard", icon: "◴", label: "Dashboard" },
  { href: "/scorecards/capture", icon: "▦", label: "Capture Scorecards" },
  { href: "/scorecards/progress", icon: "↗", label: "Performance Progress" },
  { href: "/scorecards/reports", icon: "␙", label: "Reports" },
  { href: "/scorecards/setup", icon: "⚒", label: "Setup Scorecards" },
  { href: "/scorecards/kpi-library", icon: "≡", label: "KPI Library" },
];
const EPAS_NAV: NavItem[] = [
  { href: "/appraisals/dashboard", icon: "◴", label: "Dashboard" },
  { href: "/appraisals/kpi-library", icon: "☰", label: "KPI Library" },
  { href: "/appraisals/reports", icon: "␙", label: "Reports" },
];
// The delegation-of-powers register, folded in from the client's standalone
// Mandate app. Grouping and icons are ported literally from the reference
// app's own `NAV` array (assets/app.js: Register / Operate / Set up /
// Manage, with the `i:` unicode glyph per row) rather than reinvented. This
// four-group shape is already well organised and Mandate-specific, so it's
// kept as-is as Mandate's own in-section sub-groups rather than flattened or
// folded into the cross-section pinned-bottom area.
const MANDATE_REGISTER_NAV: NavItem[] = [
  { href: "/mandate/overview", icon: "■", label: "Overview" },
  { href: "/mandate", icon: "≡", label: "Delegations" },
  { href: "/mandate/authority", icon: "◆", label: "Who may do what" },
];
const MANDATE_OPERATE_NAV: NavItem[] = [
  { href: "/mandate/instruments", icon: "✎", label: "Instruments" },
  { href: "/mandate/decisions", icon: "✓", label: "Decision log" },
  { href: "/mandate/reports", icon: "☷", label: "Reports" },
];
const MANDATE_SETUP_NAV: NavItem[] = [
  { href: "/mandate/admin/structure", icon: "⚬", label: "Posts and bodies" },
  { href: "/mandate/limits", icon: "¤", label: "Financial limits" },
  { href: "/mandate/outstanding", icon: "⚠", label: "Outstanding items" },
  { href: "/mandate/admin/library", icon: "▤", label: "By-law library" },
  { href: "/mandate/admin/import", icon: "⇪", label: "Import delegations" },
];
const MANDATE_MANAGE_NAV: NavItem[] = [
  { href: "/mandate/governance", icon: "⚑", label: "Governance workspace" },
  { href: "/mandate/orgs", icon: "⊞", label: "Organisations" },
  { href: "/mandate/settings", icon: "⚙", label: "Settings" },
];
const MANDATE_GROUPS: NavSection[] = [
  { id: "mandate-register", label: "Mandate — Register", items: MANDATE_REGISTER_NAV },
  { id: "mandate-operate", label: "Mandate — Operate", items: MANDATE_OPERATE_NAV },
  { id: "mandate-setup", label: "Mandate — Set up", items: MANDATE_SETUP_NAV },
  { id: "mandate-manage", label: "Mandate — Manage", items: MANDATE_MANAGE_NAV },
];

// Global/cross-cutting admin screens - not owned by any one product. These
// render in EVERY section's pinned-bottom area (per the client: "there might
// be feature specific setups needed and global settings"), merged with
// whatever setup screens are specific to the active section (EPAS Setup for
// EPAS; SDBIP has none of its own here since Setup Scorecards/KPI Library
// are already explicit mid-list items; Mandate's own admin screens stay in
// its "Set up" group above rather than duplicating here, since they're not
// global). Order matches the reference setup flow: orgs must exist before
// employees can be added to them, before product-specific policy config
// means anything, before inviting users is the natural last step.
const ORG_GLOBAL_NAV: NavItem[] = [
  { href: "/orgs", icon: "⌂", label: "Org Management" },
  { href: "/employees", icon: "☺", label: "Employees" },
];
const EPAS_SETUP_EXTRA: NavItem = { href: "/appraisals/setup", icon: "⚙", label: "EPAS Setup" };
const USER_GLOBAL_NAV: NavItem[] = [{ href: "/users", icon: "☷", label: "Manage Users" }];

function getPinnedBottomItems(
  section: SectionId | null,
  canManageOrgs: boolean,
  canManageUsers: boolean
): NavItem[] {
  const items: NavItem[] = [];
  if (canManageOrgs) {
    items.push(...ORG_GLOBAL_NAV);
    if (section === "epas") items.push(EPAS_SETUP_EXTRA);
  }
  if (canManageUsers) items.push(...USER_GLOBAL_NAV);
  return items;
}

// Every product now lives entirely under its own single URL namespace
// (/scorecards/* for SDBIP, /appraisals/* for EPAS, /mandate/* for Mandate),
// so which section a route belongs to is a pure, unambiguous prefix match -
// no shared routes (the old /reports, /kpi-library etc. each got split into
// a section-owned copy - see appraisals/reports/page.tsx +
// scorecards/reports/page.tsx) and no cookie fallback needed. Anything
// outside these three prefixes (the hub itself, and the deliberately
// cross-cutting /orgs, /employees, /users) resolves to no section at all.
const SECTION_PREFIXES: { id: SectionId; prefix: string }[] = [
  { id: "sdbip", prefix: "/scorecards" },
  { id: "epas", prefix: "/appraisals" },
  { id: "mandate", prefix: "/mandate" },
];

function detectSection(pathname: string): SectionId | null {
  for (const { id, prefix } of SECTION_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return id;
  }
  return null;
}

// Sections collapsed by default (before any cookie override) - only
// Mandate's own sub-groups use this now (SDBIP/EPAS are flat, scoped lists
// with no headers to collapse).
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
  const pathname = usePathname();

  // The path alone always says which section (if any) is active now - every
  // product lives under its own single URL prefix (see SECTION_PREFIXES
  // above), so this is a pure function of the current route with no cookie,
  // no server round-trip, and no stale state: a fresh session landing
  // directly on e.g. /appraisals/reports via a bookmark resolves to "epas"
  // on the very first render, same as clicking there from inside the app.
  const activeSection = detectSection(pathname);
  const isHub = pathname === "/dashboard";

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

  const pinnedBottomItems = getPinnedBottomItems(activeSection, canManageOrgs, canManageUsers);

  // The main, section-scoped body: SDBIP/EPAS are flat lists (short and
  // specific per the brief, no headers needed since there's only one
  // section on screen at a time now); Mandate keeps its own four
  // independently-collapsible sub-groups, ported unchanged from before this
  // restructure.
  let mainSections: NavSection[] = [];
  if (activeSection === "sdbip") mainSections = [{ id: "sdbip", label: "SDBIP", items: SDBIP_NAV }];
  else if (activeSection === "epas") mainSections = [{ id: "epas", label: "EPAS", items: EPAS_NAV }];
  else if (activeSection === "mandate") mainSections = MANDATE_GROUPS;

  // The link back to the hub should be available everywhere except the hub
  // itself - including on global/cross-cutting routes (e.g. /orgs) that
  // don't belong to any product section at all (detectSection() returns
  // null for them). Without this, landing on one of those routes with no
  // resolvable section renders a dead end: no nav, no way back except the
  // browser's own Back button.
  const topItems: NavItem[] = isHub ? [] : [SYSTEM_HUB_ITEM];
  const bottomSection: NavSection | null =
    pinnedBottomItems.length > 0 ? { id: "setup", label: "Organisation Setup", items: pinnedBottomItems } : null;

  // The icon-only rail has no room for section headers, so it falls back to
  // one flat, deduplicated list (Reports would otherwise show up twice if a
  // future section list ever repeats it).
  const flatUnique: NavItem[] = [];
  const seenHrefs = new Set<string>();
  for (const item of [...topItems, ...mainSections.flatMap((s) => s.items), ...pinnedBottomItems]) {
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
        {collapsed ? (
          // Icon rail: no room for section labels, so every currently-scoped
          // item (deduplicated) renders flat, with a single divider standing
          // in for the section break between the main list and setup.
          <>
            {flatUnique.map((item) => (
              <div key={item.href} className="max-[900px]:contents">
                {bottomSection && item.href === bottomSection.items[0]?.href && (
                  <div className="my-2 border-t border-white/10 max-[900px]:my-0 max-[900px]:h-6 max-[900px]:w-px max-[900px]:border-t-0 max-[900px]:border-l" />
                )}
                <NavLink {...item} collapsed={collapsed} />
              </div>
            ))}
            {flatUnique.length === 0 && (
              <div className="px-2 py-1 text-center text-xs text-white/30">—</div>
            )}
          </>
        ) : (
          <>
            {!activeSection && mainSections.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/40">
                Pick a section from the System Hub to see its navigation here.
              </p>
            )}
            {topItems.map((item) => (
              <NavLink key={item.href} {...item} collapsed={collapsed} />
            ))}
            {topItems.length > 0 && (
              <div className="my-1 border-t border-white/10 max-[900px]:my-0 max-[900px]:h-6 max-[900px]:w-px max-[900px]:border-t-0 max-[900px]:border-l" />
            )}

            {mainSections.length === 1 && mainSections[0].id !== "mandate-register"
              ? // SDBIP/EPAS: flat, unheadered list - short and specific, no
                // section chrome needed for a sidebar that's already scoped
                // to one product.
                mainSections[0].items.map((item) => <NavLink key={item.href} {...item} collapsed={collapsed} />)
              : mainSections.map((section) => {
                  const open = !collapsedSections.includes(section.id);
                  return (
                    <div key={section.id} className="max-[900px]:contents">
                      <SectionHeader
                        label={section.label}
                        open={open}
                        empty={section.items.length === 0}
                        onToggle={() => toggleSection(section.id)}
                      />
                      {open && section.items.map((item) => <NavLink key={item.href} {...item} collapsed={collapsed} />)}
                    </div>
                  );
                })}

            {bottomSection && (
              <div className="mt-auto max-[900px]:contents">
                <SectionHeader
                  label={bottomSection.label}
                  open={!collapsedSections.includes(bottomSection.id)}
                  empty={false}
                  onToggle={() => toggleSection(bottomSection.id)}
                />
                {!collapsedSections.includes(bottomSection.id) &&
                  bottomSection.items.map((item) => <NavLink key={item.href} {...item} collapsed={collapsed} />)}
              </div>
            )}
          </>
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
