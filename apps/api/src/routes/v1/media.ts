import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as mediaService from "../../services/media.js";

type Env = { Variables: { user: { id: string; role: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// ─── Response schemas ─────────────────────────────────────────────────────────

const mediaSchema = z.object({
  id: z.string(),
  uploaderId: z.string(),
  filename: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  url: z.string(),
  altText: z.string().nullable(),
  folder: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const mediaResponse = z.object({ success: z.literal(true), data: mediaSchema });
const mediaListResponse = z.object({
  success: z.literal(true),
  data: z.array(mediaSchema),
  meta: z.object({ total: z.number(), page: z.number(), pageSize: z.number() }),
});

function serializeMedia(m: NonNullable<Awaited<ReturnType<typeof mediaService.getMedia>>>) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// ─── POST /media/upload ───────────────────────────────────────────────────────

const uploadRoute = createRoute({
  method: "post",
  path: "/media/upload",
  tags: ["Media"],
  summary: "Upload media file",
  description:
    "Uploads an image to S3-compatible storage. " +
    "Image optimization (WebP variants) runs asynchronously via the image worker. " +
    "Accepts multipart/form-data with a `file` field.",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: {
        /**
         * We document as application/octet-stream to satisfy OpenAPI schema
         * (Hono doesn't have a built-in multipart schema type in zod-openapi).
         * Actual parsing uses c.req.parseBody() which handles multipart correctly.
         */
        "application/octet-stream": { schema: z.object({}) },
      },
    },
  },
  responses: {
    201: { content: { "application/json": { schema: mediaResponse } }, description: "Uploaded" },
  },
});

router.openapi(uploadRoute, async (c) => {
  const user = c.get("user");

  // Parse multipart form — Hono's built-in parser handles File objects
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    throw AppError.validation("Missing file field in multipart/form-data body");
  }

  const altText = typeof body["altText"] === "string" ? body["altText"] : null;
  const folder = typeof body["folder"] === "string" ? body["folder"] : null;

  // Convert Web API File → Buffer for S3 upload and sharp processing
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const mediaRecord = await mediaService.uploadMedia({
    uploaderId: user.id,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    buffer,
    altText,
    folder,
  });

  return c.json({ success: true as const, data: serializeMedia(mediaRecord) }, 201);
});

// ─── GET /media ───────────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/media",
    tags: ["Media"],
    summary: "List my uploaded media",
    middleware: [requireAuth] as const,
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }),
    },
    responses: {
      200: { content: { "application/json": { schema: mediaListResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { page, pageSize } = c.req.valid("query");
    const result = await mediaService.listUploaderMedia(user.id, page, pageSize);

    return c.json({
      success: true as const,
      data: result.data.map(serializeMedia),
      meta: { total: result.total, page, pageSize },
    }, 200);
  }
);

// ─── GET /media/:id ───────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/media/{id}",
    tags: ["Media"],
    summary: "Get media by ID",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { "application/json": { schema: mediaResponse } }, description: "OK" },
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const m = await mediaService.getMedia(id);
    return c.json({ success: true as const, data: serializeMedia(m) }, 200);
  }
);

// ─── DELETE /media/:id ────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/media/{id}",
    tags: ["Media"],
    summary: "Delete media record",
    description:
      "Removes the DB record. The S3 object is retained to avoid breaking embedded content. " +
      "S3 cleanup is handled via lifecycle policies (Phase 5+).",
    middleware: [requireAuth] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.literal(true) }) } },
        description: "Deleted",
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    await mediaService.deleteMedia(id, user.id, user.role);
    return c.json({ success: true as const }, 200);
  }
);

export { router as mediaRouter };
