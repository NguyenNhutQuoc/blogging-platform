import { cors } from "hono/cors";
import { env } from "../lib/env.js";

/**
 * CORS configuration — allows requests from web, admin, and local dev.
 * In production, replace wildcard with explicit origin list.
 */
export const corsMiddleware = cors({
  origin: [env.APP_URL, env.ADMIN_URL, "http://localhost:3000", "http://localhost:3002"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposeHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400,
});
