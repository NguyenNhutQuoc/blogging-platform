import type { NextConfig } from "next";

/**
 * Next.js 16 config for admin app.
 * - Turbopack enabled via --turbopack flag (not here)
 * - No middleware.ts — proxy.ts handles API forwarding per CLAUDE.md spec
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
