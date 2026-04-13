import { OpenAPIHono } from "@hono/zod-openapi";
import { auth } from "../../lib/auth.js";

const router = new OpenAPIHono();

/**
 * Mount Better Auth's handler at /auth.
 * Better Auth handles all sub-routes internally:
 *   POST /auth/sign-in/email
 *   POST /auth/sign-up/email
 *   POST /auth/sign-out
 *   GET  /auth/session
 *   POST /auth/forget-password
 *   POST /auth/reset-password
 *   GET  /auth/callback/:provider  (OAuth)
 *
 * We use a wildcard route so ALL auth sub-paths are forwarded.
 */
router.all("/*", (c) => {
  return auth.handler(c.req.raw);
});

export { router as authRouter };
