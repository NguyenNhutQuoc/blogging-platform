import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as userService from "../../services/users.js";
import * as settingsService from "../../services/settings.js";
import * as pagesService from "../../services/pages.js";
import * as auditRepo from "../../repositories/audit.js";
import {
  listUsersSchema,
  changeRoleSchema,
  changeStatusSchema,
  listAuditLogsSchema,
  upsertSettingsSchema,
  createPageSchema,
  updatePageSchema,
} from "@repo/validators/admin";

type Env = { Variables: { user: { id: string; role: string; email: string; name: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContext(c: Context) {
  return {
    ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    ua: c.req.header("user-agent") ?? undefined,
  };
}

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.enum(["admin", "editor", "author", "subscriber"]),
  status: z.enum(["active", "suspended", "banned"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const pageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  status: z.enum(["draft", "published"]),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const auditLogSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  oldValues: z.unknown().nullable(),
  newValues: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});

function serializeUser(u: Awaited<ReturnType<typeof userService.getUser>>) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

function serializePage(p: Awaited<ReturnType<typeof pagesService.createPage>>) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    content: p.content,
    status: p.status,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const successData = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data });

const paginatedData = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(data),
    meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }),
  });

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/users",
    tags: ["Admin"],
    summary: "List users (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { query: listUsersSchema },
    responses: {
      200: { content: { "application/json": { schema: paginatedData(userSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const filter = c.req.valid("query");
    const { data, total } = await userService.listUsers(filter);
    return c.json({
      success: true as const,
      data: data.map(serializeUser),
      meta: { page: filter.page, pageSize: filter.pageSize, total, totalPages: Math.ceil(total / filter.pageSize) },
    }, 200);
  }
);

// ─── GET /admin/users/:id ─────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/users/{id}",
    tags: ["Admin"],
    summary: "Get user by ID (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: successData(userSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const user = await userService.getUser(id);
    return c.json({ success: true as const, data: serializeUser(user) }, 200);
  }
);

// ─── PATCH /admin/users/:id/role ──────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/admin/users/{id}/role",
    tags: ["Admin"],
    summary: "Change user role (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: changeRoleSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successData(userSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const user = await userService.changeRole(actor.id, id, body, getContext(c));
    return c.json({ success: true as const, data: serializeUser(user) }, 200);
  }
);

// ─── PATCH /admin/users/:id/status ────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/admin/users/{id}/status",
    tags: ["Admin"],
    summary: "Change user status (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: changeStatusSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successData(userSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const user = await userService.changeStatus(actor.id, id, body, getContext(c));
    return c.json({ success: true as const, data: serializeUser(user) }, 200);
  }
);

// ─── GET /admin/audit-logs ────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/audit-logs",
    tags: ["Admin"],
    summary: "List audit logs (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { query: listAuditLogsSchema },
    responses: {
      200: { content: { "application/json": { schema: paginatedData(auditLogSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const filter = c.req.valid("query");
    const { data, total } = await auditRepo.listAuditLogs(filter);
    return c.json({
      success: true as const,
      data: data.map((l) => ({
        id: l.id,
        actorId: l.actorId ?? null,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId ?? null,
        oldValues: l.oldValues ?? null,
        newValues: l.newValues ?? null,
        ipAddress: l.ipAddress ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total, totalPages: Math.ceil(total / filter.pageSize) },
    }, 200);
  }
);

// ─── GET /admin/settings ──────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/settings",
    tags: ["Admin"],
    summary: "Get all site settings (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.record(z.unknown()) }) } }, description: "OK" },
    },
  }),
  async (c) => {
    const data = await settingsService.getAllSettings();
    return c.json({ success: true as const, data }, 200);
  }
);

// ─── PUT /admin/settings ──────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "put",
    path: "/admin/settings",
    tags: ["Admin"],
    summary: "Upsert site settings (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { body: { content: { "application/json": { schema: upsertSettingsSchema } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.record(z.unknown()) }) } }, description: "OK" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const body = c.req.valid("json");
    const data = await settingsService.upsertSettings(body, actor.id, getContext(c));
    return c.json({ success: true as const, data }, 200);
  }
);

// ─── GET /pages (public) ──────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/pages/{slug}",
    tags: ["Pages"],
    summary: "Get page by slug (public)",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: successData(pageSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const { slug } = c.req.valid("param");
    const page = await pagesService.getPageBySlug(slug);
    return c.json({ success: true as const, data: serializePage(page) }, 200);
  }
);

// ─── GET /admin/pages ─────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/admin/pages",
    tags: ["Admin"],
    summary: "List pages (admin)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    responses: {
      200: { content: { "application/json": { schema: successData(z.array(pageSchema)) } }, description: "OK" },
    },
  }),
  async (c) => {
    const pages = await pagesService.listPages();
    return c.json({ success: true as const, data: pages.map(serializePage) }, 200);
  }
);

// ─── POST /admin/pages ────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/admin/pages",
    tags: ["Admin"],
    summary: "Create page (admin)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: { body: { content: { "application/json": { schema: createPageSchema } }, required: true } },
    responses: {
      201: { content: { "application/json": { schema: successData(pageSchema) } }, description: "Created" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const body = c.req.valid("json");
    const page = await pagesService.createPage(body, actor.id, getContext(c));
    return c.json({ success: true as const, data: serializePage(page) }, 201);
  }
);

// ─── PATCH /admin/pages/:id ───────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/admin/pages/{id}",
    tags: ["Admin"],
    summary: "Update page (admin)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: updatePageSchema } }, required: true },
    },
    responses: {
      200: { content: { "application/json": { schema: successData(pageSchema) } }, description: "OK" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const page = await pagesService.updatePage(id, body, actor.id, getContext(c));
    return c.json({ success: true as const, data: serializePage(page) }, 200);
  }
);

// ─── DELETE /admin/pages/:id ──────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/admin/pages/{id}",
    tags: ["Admin"],
    summary: "Delete page (admin)",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.literal(true) }) } }, description: "Deleted" },
    },
  }),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    await pagesService.deletePage(id, actor.id, getContext(c));
    return c.json({ success: true as const }, 200);
  }
);

export { router as adminRouter };
