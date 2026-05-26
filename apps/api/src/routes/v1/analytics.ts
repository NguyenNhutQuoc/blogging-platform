import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as analyticsService from "../../services/analytics.js";
import {
  trackPageViewSchema,
  trackReactionSchema,
  trackReadingProgressSchema,
  analyticsQuerySchema,
  postAnalyticsQuerySchema,
} from "@repo/validators/analytics";

type Env = { Variables: { user: { id: string; role: string; email: string; name: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Response schemas ─────────────────────────────────────────────────────────

const successResponse = z.object({ success: z.literal(true) });

const overviewStatsResponse = z.object({
  success: z.literal(true),
  data: z.object({
    totalViews: z.number(),
    uniqueVisitors: z.number(),
    totalReactions: z.number(),
    realtimeVisitors: z.number(),
    topPosts: z.array(z.object({ postId: z.string().nullable(), path: z.string(), views: z.number() })),
    topReferrers: z.array(z.object({ referrer: z.string(), views: z.number() })),
    viewsByDay: z.array(z.object({ date: z.string(), views: z.number() })),
  }),
});

const postStatsResponse = z.object({
  success: z.literal(true),
  data: z.object({
    totalViews: z.number(),
    uniqueVisitors: z.number(),
    avgScrollDepth: z.number(),
    finishedReadingCount: z.number(),
    avgTimeSpentSeconds: z.number(),
    reactions: z.record(z.number()),
  }),
});

const reactionCountsResponse = z.object({
  success: z.literal(true),
  data: z.record(z.number()),
});

// ─── POST /analytics/pageview ─────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/analytics/pageview",
    tags: ["Analytics"],
    summary: "Track a page view",
    request: {
      body: { content: { "application/json": { schema: trackPageViewSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Tracked" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";
    const userAgent = c.req.header("user-agent") ?? "";

    await analyticsService.trackPageView(body, { ip, userAgent });
    return c.json({ success: true as const }, 200);
  }
);

// ─── POST /analytics/reaction ─────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/analytics/reaction",
    tags: ["Analytics"],
    summary: "Track a post reaction",
    request: {
      body: { content: { "application/json": { schema: trackReactionSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Tracked" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    // Optionally attach user if authenticated — best-effort, not enforced
    let userId: string | undefined;
    try {
      const user = c.get("user");
      userId = user?.id;
    } catch {
      // unauthenticated — fine
    }
    await analyticsService.trackReaction(body, userId);
    return c.json({ success: true as const }, 200);
  }
);

// ─── POST /analytics/reading-progress ────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/analytics/reading-progress",
    tags: ["Analytics"],
    summary: "Track reading progress for a post",
    request: {
      body: { content: { "application/json": { schema: trackReadingProgressSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Tracked" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    let userId: string | undefined;
    try {
      const user = c.get("user");
      userId = user?.id;
    } catch {
      // unauthenticated — fine
    }
    await analyticsService.trackReadingProgress(body, userId);
    return c.json({ success: true as const }, 200);
  }
);

// ─── GET /analytics/posts/:postId/reactions ───────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/analytics/posts/{postId}/reactions",
    tags: ["Analytics"],
    summary: "Get reaction counts for a post",
    request: { params: z.object({ postId: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: reactionCountsResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const { postId } = c.req.valid("param");
    const counts = await analyticsService.getReactionCounts(postId);
    return c.json({ success: true as const, data: counts }, 200);
  }
);

// ─── GET /admin/analytics/overview ───────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/analytics/overview",
    tags: ["Analytics"],
    summary: "Overview analytics dashboard (admin)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: { query: analyticsQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: overviewStatsResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const query = c.req.valid("query");
    const stats = await analyticsService.getOverviewStats(query);
    return c.json({ success: true as const, data: stats }, 200);
  }
);

// ─── GET /admin/analytics/posts/:postId ──────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/analytics/posts/{postId}",
    tags: ["Analytics"],
    summary: "Per-post analytics (admin/author)",
    middleware: [requireAuth, requireRole("admin", "editor", "author")] as const,
    request: {
      params: z.object({ postId: z.string() }),
      query: postAnalyticsQuerySchema,
    },
    responses: {
      200: { content: { "application/json": { schema: postStatsResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const { postId } = c.req.valid("param");
    const query = c.req.valid("query");
    const stats = await analyticsService.getPostAnalytics(postId, query);
    return c.json({ success: true as const, data: stats }, 200);
  }
);

// ─── GET /admin/analytics/realtime ───────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/analytics/realtime",
    tags: ["Analytics"],
    summary: "Real-time visitor count (last 5 minutes)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.object({ visitors: z.number() }) }) } },
        description: "OK",
      },
    },
  }),
  async (c) => {
    const visitors = await analyticsService.getRealtimeVisitors();
    return c.json({ success: true as const, data: { visitors } }, 200);
  }
);

export { router as analyticsRouter };
