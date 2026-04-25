/**
 * Client-side config — values injected via next.config.ts `env` block.
 * Use these constants instead of raw process.env in client components
 * so there's a single place to change URLs.
 */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002",
} as const;
