import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as revisionsRepo from "../../repositories/revisions.js";
import * as postsRepo from "../../repositories/posts.js";

type Env = { Variables: { user: { id: string; role: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

const revisionSchema = z.object({
  id: z.string(),
  postId: z.string(),
  editorId: z.string(),
  revisionNumber: z.number(),
  changeSummary: z.string().nullable(),
  createdAt: z.string(),
});

const revisionListResponse = z.object({
  success: z.literal(true),
  data: z.array(revisionSchema),
});

/**
 * GET /posts/:id/revisions — lists all revisions for a post, newest first.
 * Only the post author or admin/editor can view revisions.
 */
router.openapi(
  createRoute({
    method: "get",
    path: "/posts/{id}/revisions",
    tags: ["Revisions"],
    summary: "List post revisions",
    middleware: [requireAuth] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { "application/json": { schema: revisionListResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    const post = await postsRepo.findPostById(id);
    if (!post) throw AppError.notFound("Post not found");

    const canView =
      post.authorId === user.id || user.role === "admin" || user.role === "editor";
    if (!canView) throw AppError.forbidden("You can only view revisions for your own posts");

    const revisions = await revisionsRepo.findRevisionsByPost(id);

    return c.json({
      success: true as const,
      data: revisions.map((r) => ({
        id: r.id,
        postId: r.postId,
        editorId: r.editorId,
        revisionNumber: r.revisionNumber,
        changeSummary: r.changeSummary ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    }, 200);
  }
);

export { router as revisionsRouter };
