import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as postsService from "../../services/posts.js";
import {
  createPostSchema,
  updatePostSchema,
  listPostsSchema,
  schedulePostSchema,
} from "@repo/validators/post";

// ─── Context variables type ───────────────────────────────────────────────────

type AuthUser = { id: string; role: string; email: string; name: string };

type Env = {
  Variables: {
    user: AuthUser;
    session: Record<string, unknown>;
  };
};

const router = new OpenAPIHono<Env>();

// ─── Shared response schemas ──────────────────────────────────────────────────

const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const postSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  content: z.string(),
  contentJson: z.unknown().nullable(),
  coverImageUrl: z.string().nullable(),
  status: z.enum(["draft", "published", "scheduled", "archived"]),
  visibility: z.enum(["free", "pro", "premium"]),
  publishedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  readingTimeMinutes: z.number().nullable(),
  wordCount: z.number().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  seoCanonicalUrl: z.string().nullable(),
  ogImageUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: authorSchema,
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
});

const postListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(postSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

const postResponseSchema = z.object({
  success: z.literal(true),
  data: postSchema,
});

const deletedResponseSchema = z.object({ success: z.literal(true) });

/** Map a DB post row (with Date objects) to the API response shape. */
function serializePost(post: NonNullable<Awaited<ReturnType<typeof postsService.getPostById>>>) {
  return {
    id: post.id,
    authorId: post.authorId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    content: post.content,
    contentJson: post.contentJson ?? null,
    coverImageUrl: post.coverImageUrl ?? null,
    status: post.status,
    visibility: post.visibility,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    readingTimeMinutes: post.readingTimeMinutes ?? null,
    wordCount: post.wordCount ?? null,
    seoTitle: post.seoTitle ?? null,
    seoDescription: post.seoDescription ?? null,
    seoCanonicalUrl: post.seoCanonicalUrl ?? null,
    ogImageUrl: post.ogImageUrl ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    categories: post.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    tags: post.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  };
}

// ─── GET /posts ───────────────────────────────────────────────────────────────

const listPostsRoute = createRoute({
  method: "get",
  path: "/posts",
  tags: ["Posts"],
  summary: "List posts",
  description: "Returns a paginated list of posts. Supports filtering and full-text search.",
  request: { query: listPostsSchema },
  responses: {
    200: { content: { "application/json": { schema: postListResponseSchema } }, description: "OK" },
  },
});

router.openapi(listPostsRoute, async (c) => {
  const query = c.req.valid("query");
  const result = await postsService.listPosts(query);
  return c.json({ success: true as const, data: result.data.map(serializePost), meta: result.meta }, 200);
});

// ─── POST /posts ──────────────────────────────────────────────────────────────

const createPostRoute = createRoute({
  method: "post",
  path: "/posts",
  tags: ["Posts"],
  summary: "Create post",
  middleware: [requireAuth] as const,
  request: { body: { content: { "application/json": { schema: createPostSchema } }, required: true } },
  responses: {
    201: { content: { "application/json": { schema: postResponseSchema } }, description: "Created" },
  },
});

router.openapi(createPostRoute, async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const post = await postsService.createPost(
    { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber" },
    body
  );

  if (!post) throw AppError.internal("Failed to retrieve created post");

  return c.json({ success: true as const, data: serializePost(post) }, 201);
});

// ─── GET /posts/:slug ─────────────────────────────────────────────────────────

const getPostRoute = createRoute({
  method: "get",
  path: "/posts/{slug}",
  tags: ["Posts"],
  summary: "Get post by slug",
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { content: { "application/json": { schema: postResponseSchema } }, description: "OK" },
  },
});

router.openapi(getPostRoute, async (c) => {
  const { slug } = c.req.valid("param");
  const post = await postsService.getPostBySlug(slug);
  return c.json({ success: true as const, data: serializePost(post) }, 200);
});

// ─── PATCH /posts/:id ─────────────────────────────────────────────────────────

const updatePostRoute = createRoute({
  method: "patch",
  path: "/posts/{id}",
  tags: ["Posts"],
  summary: "Update post",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: updatePostSchema } }, required: true },
  },
  responses: {
    200: { content: { "application/json": { schema: postResponseSchema } }, description: "Updated" },
  },
});

router.openapi(updatePostRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const post = await postsService.updatePost(
    id,
    { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber" },
    body
  );
  if (!post) throw AppError.notFound("Post not found");

  return c.json({ success: true as const, data: serializePost(post) }, 200);
});

// ─── DELETE /posts/:id ────────────────────────────────────────────────────────

const deletePostRoute = createRoute({
  method: "delete",
  path: "/posts/{id}",
  tags: ["Posts"],
  summary: "Delete post",
  description: "Soft-deletes a post. Only the author, editors, or admins can delete.",
  middleware: [requireAuth] as const,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: deletedResponseSchema } }, description: "Deleted" },
  },
});

router.openapi(deletePostRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  await postsService.deletePost(id, { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber" });

  return c.json({ success: true as const }, 200);
});

// ─── POST /posts/:id/publish ──────────────────────────────────────────────────

const publishPostRoute = createRoute({
  method: "post",
  path: "/posts/{id}/publish",
  tags: ["Posts"],
  summary: "Publish post",
  description: "Immediately publishes a draft or scheduled post.",
  middleware: [requireAuth] as const,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { "application/json": { schema: postResponseSchema } }, description: "Published" },
  },
});

router.openapi(publishPostRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  const post = await postsService.publishPost(id, { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber" });
  if (!post) throw AppError.notFound("Post not found");

  return c.json({ success: true as const, data: serializePost(post) }, 200);
});

// ─── POST /posts/:id/schedule ─────────────────────────────────────────────────

const schedulePostRoute = createRoute({
  method: "post",
  path: "/posts/{id}/schedule",
  tags: ["Posts"],
  summary: "Schedule post",
  description: "Schedules a post for future publication. The 1-minute cron will publish it automatically.",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: schedulePostSchema } }, required: true },
  },
  responses: {
    200: { content: { "application/json": { schema: postResponseSchema } }, description: "Scheduled" },
  },
});

router.openapi(schedulePostRoute, async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const post = await postsService.schedulePost(id, { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber" }, body);
  if (!post) throw AppError.notFound("Post not found");

  return c.json({ success: true as const, data: serializePost(post) }, 200);
});

export { router as postsRouter };
