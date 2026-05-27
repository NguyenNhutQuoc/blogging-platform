import { z } from "zod";
import { paginationSchema } from "./pagination";

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsersSchema = paginationSchema.extend({
  role: z.enum(["admin", "editor", "author", "subscriber"]).optional(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  search: z.string().max(100).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(["admin", "editor", "author", "subscriber"]),
});

export const changeStatusSchema = z.object({
  status: z.enum(["active", "suspended", "banned"]),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const listAuditLogsSchema = paginationSchema.extend({
  actorId: z.string().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().optional(),
  action: z.string().max(100).optional(),
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;

// ─── Site Settings ────────────────────────────────────────────────────────────

export const upsertSettingsSchema = z.record(z.string(), z.unknown());
export type UpsertSettingsInput = z.infer<typeof upsertSettingsSchema>;

// ─── Pages ───────────────────────────────────────────────────────────────────

export const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  content: z.string().default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
});

export const updatePageSchema = createPageSchema.partial();

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

// ─── Redirects ────────────────────────────────────────────────────────────────

export const createRedirectSchema = z.object({
  fromPath: z.string().min(1).max(500).startsWith("/", "Must start with /"),
  toPath: z.string().min(1).max(500),
  statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
  isActive: z.boolean().default(true),
});

export const updateRedirectSchema = createRedirectSchema.partial();

export type CreateRedirectInput = z.infer<typeof createRedirectSchema>;
export type UpdateRedirectInput = z.infer<typeof updateRedirectSchema>;
