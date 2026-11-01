import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets `next build` run beside a live `next dev` without clobbering its .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
