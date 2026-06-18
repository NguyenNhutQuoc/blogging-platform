import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Next.js 16 config for admin app.
 * - Turbopack enabled via --turbopack flag (not here)
 * - No middleware.ts — proxy.ts handles API forwarding per CLAUDE.md spec
 */
const nextConfig: NextConfig = {
  /**
   * Standalone output for a slim production Docker image; tracing root is the
   * monorepo root so pnpm workspace symlinks (@repo/*) are followed correctly.
   */
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  experimental: {
    // Required to use the "use cache" directive (Next.js 15.x)
    useCache: true,
  },
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
