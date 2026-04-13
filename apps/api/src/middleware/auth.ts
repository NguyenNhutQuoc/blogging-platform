import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import type { UserRole } from "@repo/shared";

/**
 * Dual-mode auth middleware — accepts BOTH:
 * 1. Session cookie (web app — set by Better Auth after login)
 * 2. Bearer token in Authorization header (mobile-ready)
 *
 * This lets the same API serve web and future mobile clients
 * without separate auth routes.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    throw AppError.unauthorized();
  }

  // Attach session to context so route handlers can access it
  c.set("user", session.user);
  c.set("session", session.session);

  await next();
});

/**
 * Role-based access guard — call after requireAuth.
 * Usage: requireRole("admin") or requireRole("editor", "admin")
 */
export function requireRole(...roles: UserRole[]): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const user = c.get("user") as { role: UserRole } | undefined;

    if (!user) {
      throw AppError.unauthorized();
    }

    if (!roles.includes(user.role)) {
      throw AppError.forbidden(`This action requires one of: ${roles.join(", ")}`);
    }

    await next();
  });
}
