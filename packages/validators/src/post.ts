import { z } from "zod";

const postStatusEnum = z.enum(["draft", "published", "scheduled", "archived"]);
const postVisibilityEnum = z.enum(["free", "pro", "premium"]);

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  excerpt: z.string().max(500, "Excerpt too long").optional().nullable(),
  content: z.string().default(""),
  contentJson: z.record(z.unknown()).optional().nullable(),
  coverImageUrl: z.string().url("Invalid URL").optional().nullable(),
  status: postStatusEnum.default("draft"),
  visibility: postVisibilityEnum.default("free"),
  scheduledAt: z.string().datetime().optional().nullable(),
  seoTitle: z.string().max(70, "SEO title too long (max 70 chars)").optional().nullable(),
  seoDescription: z
    .string()
    .max(160, "SEO description too long (max 160 chars)")
    .optional()
    .nullable(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
  tagIds: z.array(z.string().uuid()).optional().default([]),
});

export const updatePostSchema = createPostSchema.partial();

export const schedulePostSchema = z.object({
  scheduledAt: z.string().datetime("Must be a valid ISO 8601 datetime"),
});

export const listPostsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: postStatusEnum.optional(),
  visibility: postVisibilityEnum.optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  authorId: z.string().uuid().optional(),
  q: z.string().max(255).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
export type ListPostsInput = z.infer<typeof listPostsSchema>;
