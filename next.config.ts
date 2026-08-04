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
};

export default nextConfig;
