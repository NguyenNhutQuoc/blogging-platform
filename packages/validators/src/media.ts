import { z } from "zod";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const updateMediaSchema = z.object({
  altText: z.string().max(255, "Alt text too long").optional().nullable(),
  caption: z.string().max(500, "Caption too long").optional().nullable(),
  folder: z.string().max(100).optional().nullable(),
});

export const uploadMediaSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  mimeType: z
    .string()
    .refine(
      (val): val is (typeof ALLOWED_MIME_TYPES)[number] =>
        (ALLOWED_MIME_TYPES as readonly string[]).includes(val),
      "Only image files are allowed (jpeg, png, webp, gif, avif)"
    ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, "File too large (max 10 MB)"),
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
