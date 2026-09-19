import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Quarter tabs on /scorecards/[id] are the same route with a different
    // ?q= search param. Without this, Next's client-side router cache can
    // briefly reuse a previously-viewed quarter's data when switching tabs.
    staleTimes: {
      dynamic: 0,
    },
  },
  // Every product used to live partly at top-level, ambiguous routes
  // (/dashboard's EPAS half at /appraisals, /reports shared by SDBIP and
  // EPAS, /kpi-library and /progress top-level for SDBIP, /epas-kpi-library
  // and /epas-setup top-level for EPAS). That's what made the sidebar's old
  // pathname-prefix detection unreliable - see src/components/Sidebar.tsx's
  // detectSection(). Everything now lives under one unambiguous namespace
  // per product (/appraisals/* for EPAS, /scorecards/* for SDBIP,
  // /mandate/* for Mandate, unchanged). These redirects keep every old
  // bookmark and external link working by forwarding to the new location -
  // permanent (308) since the old routes are gone for good, not just moved
  // temporarily.
  async redirects() {
    return [
      // EPAS dashboard: was the shared hub's /appraisals landing page.
      { source: "/appraisals", destination: "/appraisals/dashboard", permanent: true },

      // EPAS KPI library.
      { source: "/epas-kpi-library", destination: "/appraisals/kpi-library", permanent: true },
      { source: "/epas-kpi-library/:path*", destination: "/appraisals/kpi-library/:path*", permanent: true },

      // EPAS Setup.
      { source: "/epas-setup", destination: "/appraisals/setup", permanent: true },
      { source: "/epas-setup/:path*", destination: "/appraisals/setup/:path*", permanent: true },

      // SDBIP dashboard: was the shared hub's /scorecards landing page.
      { source: "/scorecards", destination: "/scorecards/dashboard", permanent: true },

      // Performance Progress (SDBIP).
      { source: "/progress", destination: "/scorecards/progress", permanent: true },
      { source: "/progress/:path*", destination: "/scorecards/progress/:path*", permanent: true },

      // KPI Type Generator (SDBIP).
      { source: "/kpi-library", destination: "/scorecards/kpi-library", permanent: true },
      { source: "/kpi-library/:path*", destination: "/scorecards/kpi-library/:path*", permanent: true },

      // The old shared Reports hub (org-wide summary/CSV export were EPAS,
      // the scorecards ZIP export + annual print link were SDBIP) - split
      // into two section-owned pages. /reports itself forwards to its EPAS
      // half, since that was the larger share of the old page's content;
      // the SDBIP-only export routes forward to their new SDBIP home.
      { source: "/reports", destination: "/appraisals/reports", permanent: true },
      { source: "/reports/csv", destination: "/appraisals/reports/csv", permanent: true },
      { source: "/reports/scorecards-zip", destination: "/scorecards/reports/scorecards-zip", permanent: true },
    ];
  },
};

export default nextConfig;
