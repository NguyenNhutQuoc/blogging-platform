import { createApiClient } from "@repo/api-client";

/**
 * Server-side API client — uses the internal API URL for SSR data fetching.
 * This avoids an extra network hop through the public internet / load balancer.
 *
 * In production: API_URL should be the internal service URL (e.g. http://api:3001).
 * In dev: falls back to localhost:3001.
 */
export const api = createApiClient(
  process.env.API_URL ?? "http://localhost:3001"
);
