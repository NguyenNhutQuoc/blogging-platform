import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as categoriesService from "../../services/categories.js";

type Env = { Variables: { user: { id: string; role: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Shared schema ────────────────────────────────────────────────────────────

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const categoryListResponse = z.object({ success: z.literal(true), data: z.array(categorySchema) });
const categoryResponse = z.object({ success: z.literal(true), data: categorySchema });
const deletedResponse = z.object({ success: z.literal(true) });

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateCategorySchema = createCategorySchema.partial();

function serializeCategory(cat: NonNullable<Awaited<ReturnType<typeof categoriesService.listCategories>>>[number]) {
  return {
    ...cat,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  };
}

// ─── GET /categories ──────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/categories",
    tags: ["Categories"],
    summary: "List all categories",
    responses: { 200: { content: { "application/json": { schema: categoryListResponse } }, description: "OK" } },
  }),
  async (c) => {
    const cats = await categoriesService.listCategories();
    return c.json({ success: true as const, data: cats.map(serializeCategory) }, 200);
  }
);

// ─── GET /categories/:slug ────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/categories/{slug}",
    tags: ["Categories"],
    summary: "Get category by slug",
    request: { params: z.object({ slug: z.string() }) },
    responses: { 200: { content: { "application/json": { schema: categoryResponse } }, description: "OK" } },
  }),
  async (c) => {
    const { slug } = c.req.valid("param");
    const cat = await categoriesService.getCategoryBySlug(slug);
    return c.json({ success: true as const, data: serializeCategory(cat) }, 200);
  }
);

// ─── POST /categories (admin/editor only) ─────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/categories",
    tags: ["Categories"],
    summary: "Create category",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: { body: { content: { "application/json": { schema: createCategorySchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: categoryResponse } }, description: "Created" } },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const cat = await categoriesService.createCategory(body);
    return c.json({ success: true as const, data: serializeCategory(cat) }, 201);
  }
);

// ─── PATCH /categories/:id ────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/categories/{id}",
    tags: ["Categories"],
    summary: "Update category",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { "application/json": { schema: updateCategorySchema } }, required: true },
    },
    responses: { 200: { content: { "application/json": { schema: categoryResponse } }, description: "Updated" } },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const cat = await categoriesService.updateCategory(id, body);
    return c.json({ success: true as const, data: serializeCategory(cat!) }, 200);
  }
);

// ─── DELETE /categories/:id ───────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/categories/{id}",
    tags: ["Categories"],
    summary: "Delete category",
    description: "Deletes a category. Fails if any posts are currently assigned to it.",
    middleware: [requireAuth, requireRole("admin")] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { content: { "application/json": { schema: deletedResponse } }, description: "Deleted" } },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    await categoriesService.deleteCategory(id);
    return c.json({ success: true as const }, 200);
  }
);

export { router as categoriesRouter };
