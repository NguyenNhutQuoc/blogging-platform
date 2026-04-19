import { createApiClient } from "@repo/api-client";

/**
 * Admin API client.
 * Token is not used here — authentication is via session cookie, which is
 * forwarded automatically by the browser through the proxy.ts route.
 */
export const api = createApiClient(
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:3001")
    : "" // relative path — proxy.ts forwards to the real API
);
