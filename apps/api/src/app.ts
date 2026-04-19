import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { corsMiddleware } from "./middleware/cors.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/v1/health.js";
import { authRouter } from "./routes/v1/auth.js";
import { postsRouter } from "./routes/v1/posts.js";
import { categoriesRouter } from "./routes/v1/categories.js";
import { tagsRouter } from "./routes/v1/tags.js";
import { mediaRouter } from "./routes/v1/media.js";
import { revisionsRouter } from "./routes/v1/revisions.js";
import { commentsRouter } from "./routes/v1/comments.js";

/**
 * Main Hono application.
 * Using OpenAPIHono (instead of plain Hono) so every route defined
 * with createRoute() is automatically included in the OpenAPI 3.1 spec.
 */
export const app = new OpenAPIHono();

// ── Global middleware ──────────────────────────────────────────────────────
app.use("*", loggerMiddleware);
app.use("*", corsMiddleware);

// ── OpenAPI spec ───────────────────────────────────────────────────────────
app.doc("/api/v1/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Blog Platform API",
    version: "1.0.0",
    description:
      "Professional multi-author blogging platform API. " +
      "Supports both cookie-based auth (web) and Bearer token auth (mobile).",
  },
  servers: [{ url: "/", description: "Current server" }],
});

/**
 * Scalar API reference UI — served at /api/docs.
 * Mobile developers can use the OpenAPI spec at /api/v1/openapi.json
 * to generate typed SDKs for Swift, Kotlin, etc.
 */
app.get(
  "/api/docs",
  apiReference({
    theme: "purple",
    spec: { url: "/api/v1/openapi.json" },
  })
);

// ── Routes ─────────────────────────────────────────────────────────────────
app.route("/api/v1", healthRouter);
app.route("/api/v1/auth", authRouter);
app.route("/api/v1", postsRouter);
app.route("/api/v1", categoriesRouter);
app.route("/api/v1", tagsRouter);
app.route("/api/v1", mediaRouter);
app.route("/api/v1", revisionsRouter);
app.route("/api/v1", commentsRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    },
    404
  );
});

// ── Global error handler ───────────────────────────────────────────────────
app.onError(errorHandler);

export type AppType = typeof app;
