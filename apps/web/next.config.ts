import type { NextConfig } from "next";

/**
 * Next.js 16 config.
 * - Turbopack is enabled via `--turbopack` flag in the dev script (not here).
 * - No middleware.ts — we use proxy.ts for API forwarding per CLAUDE.md spec.
 * - `use cache` directive is enabled in Next.js 15+ by default.
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
        // Production: Cloudflare R2 public bucket URL
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
