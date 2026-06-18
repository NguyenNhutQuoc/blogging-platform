import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Next.js 16 config.
 * - Turbopack is enabled via `--turbopack` flag in the dev script (not here).
 * - No middleware.ts — we use proxy.ts for API forwarding per CLAUDE.md spec.
 * - `use cache` directive is enabled in Next.js 15+ by default.
 */
const nextConfig: NextConfig = {
  /**
   * Emit a self-contained server bundle in `.next/standalone` so the
   * production Docker image only ships traced dependencies (small image).
   * `outputFileTracingRoot` points at the monorepo root so the tracer
   * follows pnpm workspace symlinks (@repo/* packages) correctly.
   */
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3003",
    NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.ADMIN_URL ?? "http://localhost:3002",
  },
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
        // Production: Cloudflare R2 public bucket URL
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
