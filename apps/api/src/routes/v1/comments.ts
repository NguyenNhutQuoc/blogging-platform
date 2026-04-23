import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as commentsService from "../../services/comments.js";

type Env = { Variables: { user: { id: string; role: string; email: string; name: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const authorSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const commentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string().nullable(),
  parentId: z.string().nullable(),
  content: z.string(),
  status: z.enum(["pending", "approved", "spam", "deleted"]),
  guestName: z.string().nullable(),
  guestEmail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: authorSchema.nullable(),
});

const commentListResponse = z.object({
  success: z.literal(true),
  data: z.array(commentSchema),
  meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }),
});

const commentResponse = z.object({ success: z.literal(true), data: commentSchema });
const deletedResponse = z.object({ success: z.literal(true) });

const createCommentSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000),
  parentId: z.string().uuid().optional().nullable(),
});

type CommentAuthorShape = { id: string; name: string; avatarUrl: string | null } | null;

type SerializableComment = Awaited<ReturnType<typeof commentsService.createComment>> & {
  author?: CommentAuthorShape;
};

function serializeComment(comment: SerializableComment) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId ?? null,
    parentId: comment.parentId ?? null,
    content: comment.content,
    status: comment.status,
    guestName: comment.guestName ?? null,
    guestEmail: comment.guestEmail ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: comment.author ?? null,
  };
}

// ─── GET /posts/:postId/comments ──────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/posts/{postId}/comments",
    tags: ["Comments"],
    summary: "List comments for a post",
    request: {
      params: z.object({ postId: z.string().uuid() }),
      query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }),
    },
    responses: {
      200: { content: { "application/json": { schema: commentListResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const { postId } = c.req.valid("param");
    const { page, pageSize } = c.req.valid("query");

    const result = await commentsService.listComments({ postId, page, pageSize });
    return c.json({
      success: true as const,
      data: result.data.map(serializeComment),
      meta: result.meta,
    }, 200);
  }
);

// ─── POST /posts/:postId/comments ─────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/posts/{postId}/comments",
    tags: ["Comments"],
    summary: "Create a comment",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ postId: z.string().uuid() }),
      body: { content: { "application/json": { schema: createCommentSchema } }, required: true },
    },
    responses: {
      201: { content: { "application/json": { schema: commentResponse } }, description: "Created" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { postId } = c.req.valid("param");
    const body = c.req.valid("json");

    const comment = await commentsService.createComment(
      { id: user.id, role: user.role as "admin" | "editor" | "author" | "subscriber", email: user.email, name: user.name },
      { postId, ...body }
    );

    return c.json({ success: true as const, data: serializeComment(comment) }, 201);
  }
);

// ─── PATCH /comments/:id ──────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "patch",
    path: "/comments/{id}",
    tags: ["Comments"],
    summary: "Edit own comment",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: z.object({ content: z.string().min(1).max(5000) }) } },
        required: true,
      },
    },
    responses: {
      200: { content: { "application/json": { schema: commentResponse } }, description: "Updated" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const { content } = c.req.valid("json");

    const comment = await commentsService.updateComment(id, {
      id: user.id,
      role: user.role as "admin" | "editor" | "author" | "subscriber",
      email: user.email,
      name: user.name,
    }, content);

    if (!comment) throw AppError.notFound("Comment not found");
    return c.json({ success: true as const, data: serializeComment(comment) }, 200);
  }
);

// ─── POST /comments/:id/moderate ──────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "post",
    path: "/comments/{id}/moderate",
    tags: ["Comments"],
    summary: "Moderate a comment (admin/editor only)",
    middleware: [requireAuth, requireRole("admin", "editor")] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({ status: z.enum(["approved", "spam", "deleted"]) }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: { content: { "application/json": { schema: commentResponse } }, description: "Moderated" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");

    const comment = await commentsService.moderateComment(
      id,
      { role: user.role as "admin" | "editor" | "author" | "subscriber" },
      status
    );

    if (!comment) throw AppError.notFound("Comment not found");
    return c.json({ success: true as const, data: serializeComment(comment) }, 200);
  }
);

// ─── DELETE /comments/:id ─────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/comments/{id}",
    tags: ["Comments"],
    summary: "Delete a comment",
    middleware: [requireAuth] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { "application/json": { schema: deletedResponse } }, description: "Deleted" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    await commentsService.deleteComment(id, {
      id: user.id,
      role: user.role as "admin" | "editor" | "author" | "subscriber",
      email: user.email,
      name: user.name,
    });

    return c.json({ success: true as const }, 200);
  }
);

export { router as commentsRouter };
