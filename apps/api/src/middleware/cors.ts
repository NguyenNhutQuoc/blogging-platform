import { cors } from "hono/cors";
import { env } from "../lib/env.js";

/**
 * Build the allowed origins list from env vars only — no hardcoded URLs.
 *
 * CORS_ORIGINS is a comma-separated list (e.g. "https://example.com,https://admin.example.com").
 * APP_URL and ADMIN_URL are always included so a minimal .env still works.
 * Duplicates are removed via Set.
 */
const allowedOrigins = [
  ...new Set([
    env.APP_URL,
    env.ADMIN_URL,
    ...env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  ]),
];

export const corsMiddleware = cors({
  origin: allowedOrigins,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposeHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400,
});
