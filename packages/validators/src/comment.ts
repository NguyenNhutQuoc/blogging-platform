import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment too long"),
  parentId: z.string().uuid().optional().nullable(),
  // Guest fields — only required when user is not authenticated
  guestName: z.string().min(1).max(100).optional(),
  guestEmail: z.string().email().optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment too long"),
});

export const moderateCommentSchema = z.object({
  status: z.enum(["approved", "spam", "deleted"]),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ModerateCommentInput = z.infer<typeof moderateCommentSchema>;
