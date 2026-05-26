import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as newsletterService from "../../services/newsletter.js";
import {
  subscribeSchema,
  createNewsletterSchema,
  updateNewsletterSchema,
  scheduleNewsletterSchema,
  listSubscribersSchema,
  listNewslettersSchema,
} from "@repo/validators/newsletter";

type Env = { Variables: { user: { id: string; role: string; email: string; name: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const subscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  status: z.enum(["active", "unsubscribed", "bounced", "complained"]),
  subscribedAt: z.string(),
  createdAt: z.string(),
});

const newsletterSchema = z.object({
  id: z.string(),
  subject: z.string(),
  previewText: z.string().nullable(),
  contentHtml: z.string(),
  contentText: z.string().nullable(),
  status: z.enum(["draft", "scheduled", "sending", "sent"]),
  scheduledAt: z.string().nullable(),
  statsSent: z.number().nullable(),
  statsOpened: z.number().nullable(),
  statsClicked: z.number().nullable(),
  authorId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const successResponse = z.object({ success: z.literal(true) });
const newsletterResponse = z.object({ success: z.literal(true), data: newsletterSchema });
const subscriberListResponse = z.object({
  success: z.literal(true),
  data: z.array(subscriberSchema),
  meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }),
});
const newsletterListResponse = z.object({
  success: z.literal(true),
  data: z.array(newsletterSchema),
  meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }),
});

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeSubscriber(s: Awaited<ReturnType<typeof newsletterService.confirmSubscription>>) {
  return {
    id: s.id,
    email: s.email,
    name: s.name ?? null,
    status: s.status,
    subscribedAt: s.subscribedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}

function serializeNewsletter(n: Awaited<ReturnType<typeof newsletterService.getNewsletter>>) {
  return {
    id: n.id,
    subject: n.subject,
    previewText: n.previewText ?? null,
    contentHtml: n.contentHtml,
    contentText: n.contentText ?? null,
    status: n.status,
    scheduledAt: n.scheduledAt?.toISOString() ?? null,
    statsSent: n.statsSent ?? null,
    statsOpened: n.statsOpened ?? null,
    statsClicked: n.statsClicked ?? null,
    authorId: n.authorId ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// ─── POST /newsletter/subscribe ───────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/newsletter/subscribe",
    tags: ["Newsletter"],
    summary: "Subscribe to the newsletter (double opt-in)",
    request: {
      body: { content: { "application/json": { schema: subscribeSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Confirmation email sent" },
    },
  }),
  async (c) => {
    const { email, name } = c.req.valid("json");
    await newsletterService.subscribe(email, name);
    return c.json({ success: true as const }, 200);
  }
);

// ─── GET /newsletter/confirm ──────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/newsletter/confirm",
    tags: ["Newsletter"],
    summary: "Confirm newsletter subscription via token",
    request: {
      query: z.object({ token: z.string().min(1) }),
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Confirmed" },
    },
  }),
  async (c) => {
    const { token } = c.req.valid("query");
    await newsletterService.confirmSubscription(token);
    return c.json({ success: true as const }, 200);
  }
);

// ─── POST /newsletter/unsubscribe ─────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/newsletter/unsubscribe",
    tags: ["Newsletter"],
    summary: "Unsubscribe from newsletter via token",
    request: {
      body: { content: { "application/json": { schema: z.object({ token: z.string().min(1) }) } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successResponse } }, description: "Unsubscribed" },
    },
  }),
  async (c) => {
    const { token } = c.req.valid("json");
    await newsletterService.unsubscribe(token);
    return c.json({ success: true as const }, 200);
  }
);

// ─── GET /newsletter/track/open/:sendId ──────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/newsletter/track/open/{sendId}",
    tags: ["Newsletter"],
    summary: "Track email open (1×1 pixel)",
    request: { params: z.object({ sendId: z.string() }) },
    responses: {
      200: { description: "1x1 transparent GIF" },
    },
  }),
  async (c) => {
    const { sendId } = c.req.valid("param");
    // Fire-and-forget — don't await to minimize latency on the tracking pixel
    newsletterService.trackOpen(sendId).catch(() => undefined);

    // 1×1 transparent GIF
    const gif = Buffer.from("R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", "base64");
    return new Response(gif, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
);

// ─── Admin: list subscribers ──────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/newsletter/subscribers",
    tags: ["Newsletter"],
    summary: "List newsletter subscribers (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { query: listSubscribersSchema },
    responses: {
      200: { content: { "application/json": { schema: subscriberListResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const filter = c.req.valid("query");
    const { data, total } = await newsletterService.listSubscribers(filter);
    return c.json({
      success: true as const,
      data: data.map(serializeSubscriber),
      meta: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.ceil(total / filter.pageSize),
      },
    }, 200);
  }
);

// ─── Admin: create newsletter ─────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/admin/newsletters",
    tags: ["Newsletter"],
    summary: "Create a newsletter draft (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: {
      body: { content: { "application/json": { schema: createNewsletterSchema } }, required: true },
    },
    responses: {
      201: { content: { "application/json": { schema: newsletterResponse } }, description: "Created" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const newsletter = await newsletterService.createNewsletter(body, user.id);
    return c.json({ success: true as const, data: serializeNewsletter(newsletter) }, 201);
  }
);

// ─── Admin: list newsletters ──────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/newsletters",
    tags: ["Newsletter"],
    summary: "List newsletters (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { query: listNewslettersSchema },
    responses: {
      200: { content: { "application/json": { schema: newsletterListResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const filter = c.req.valid("query");
    const { data, total } = await newsletterService.listNewsletters(filter);
    return c.json({
      success: true as const,
      data: data.map(serializeNewsletter),
      meta: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.ceil(total / filter.pageSize),
      },
    }, 200);
  }
);

// ─── Admin: get newsletter ────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/newsletters/{id}",
    tags: ["Newsletter"],
    summary: "Get newsletter by ID (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { "application/json": { schema: newsletterResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const newsletter = await newsletterService.getNewsletter(id);
    return c.json({ success: true as const, data: serializeNewsletter(newsletter) }, 200);
  }
);

// ─── Admin: update newsletter ─────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/admin/newsletters/{id}",
    tags: ["Newsletter"],
    summary: "Update newsletter draft (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { "application/json": { schema: updateNewsletterSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: newsletterResponse } }, description: "Updated" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const newsletter = await newsletterService.updateNewsletter(id, body);
    return c.json({ success: true as const, data: serializeNewsletter(newsletter) }, 200);
  }
);

// ─── Admin: schedule newsletter ───────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/admin/newsletters/{id}/schedule",
    tags: ["Newsletter"],
    summary: "Schedule a newsletter for future sending (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { "application/json": { schema: scheduleNewsletterSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: newsletterResponse } }, description: "Scheduled" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const newsletter = await newsletterService.scheduleNewsletter(id, body);
    return c.json({ success: true as const, data: serializeNewsletter(newsletter) }, 200);
  }
);

// ─── Admin: send newsletter now ───────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/admin/newsletters/{id}/send",
    tags: ["Newsletter"],
    summary: "Send newsletter immediately (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { "application/json": { schema: newsletterResponse } }, description: "Send dispatched" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const newsletter = await newsletterService.sendNewsletterNow(id);
    return c.json({ success: true as const, data: serializeNewsletter(newsletter) }, 200);
  }
);

export { router as newslettersRouter };
