import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as tagsService from "../../services/tags.js";

type Env = { Variables: { user: { id: string; role: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Shared schema ────────────────────────────────────────────────────────────

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

const tagListResponse = z.object({ success: z.literal(true), data: z.array(tagSchema) });
const tagResponse = z.object({ success: z.literal(true), data: tagSchema });
const deletedResponse = z.object({ success: z.literal(true) });

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
});

const updateTagSchema = createTagSchema.partial();

function serializeTag(tag: NonNullable<Awaited<ReturnType<typeof tagsService.listTags>>>[number]) {
  return { ...tag, createdAt: tag.createdAt.toISOString() };
}

// ─── GET /tags ────────────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/tags",
    tags: ["Tags"],
    summary: "List all tags",
    responses: { 200: { content: { "application/json": { schema: tagListResponse } }, description: "OK" } },
  }),
  async (c) => {
    const tags = await tagsService.listTags();
    return c.json({ success: true as const, data: tags.map(serializeTag) }, 200);
  }
);

// ─── GET /tags/:slug ──────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/tags/{slug}",
    tags: ["Tags"],
    summary: "Get tag by slug",
    request: { params: z.object({ slug: z.string() }) },
    responses: { 200: { content: { "application/json": { schema: tagResponse } }, description: "OK" } },
  }),
  async (c) => {
    const { slug } = c.req.valid("param");
    const tag = await tagsService.getTagBySlug(slug);
    return c.json({ success: true as const, data: serializeTag(tag) }, 200);
  }
);

// ─── POST /tags ───────────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/tags",
    tags: ["Tags"],
    summary: "Create tag",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: { body: { content: { "application/json": { schema: createTagSchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: tagResponse } }, description: "Created" } },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const tag = await tagsService.createTag(body);
    return c.json({ success: true as const, data: serializeTag(tag) }, 201);
  }
);

// ─── PATCH /tags/:id ──────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/tags/{id}",
    tags: ["Tags"],
    summary: "Update tag",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { "application/json": { schema: updateTagSchema } }, required: true },
    },
    responses: { 200: { content: { "application/json": { schema: tagResponse } }, description: "Updated" } },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const tag = await tagsService.updateTag(id, body);
    return c.json({ success: true as const, data: serializeTag(tag!) }, 200);
  }
);

// ─── DELETE /tags/:id ─────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/tags/{id}",
    tags: ["Tags"],
    summary: "Delete tag",
    description: "Deletes a tag. Fails if any posts are currently using it.",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { content: { "application/json": { schema: deletedResponse } }, description: "Deleted" } },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    await tagsService.deleteTag(id);
    return c.json({ success: true as const }, 200);
  }
);

export { router as tagsRouter };
