import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers";
import { users } from "./auth";

export const pageStatusEnum = pgEnum("page_status", ["draft", "published"]);

/**
 * Key-value store for site-wide configuration.
 * Avoids hard-coding settings in env vars when they need to be editable by admins.
 * Examples: site_name, seo_default_description, social_links, etc.
 */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => users.id),
});

export const redirects = pgTable(
  "redirects",
  {
    id: primaryId(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_redirects_from").on(t.fromPath)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: primaryId(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_logs_actor").on(t.actorId),
    index("idx_audit_logs_entity").on(t.entityType, t.entityId),
    index("idx_audit_logs_created").on(t.createdAt),
  ]
);

/** Static content pages — About, Privacy Policy, Terms of Service, etc. */
export const pages = pgTable(
  "pages",
  {
    id: primaryId(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content").notNull().default(""),
    status: pageStatusEnum("status").notNull().default("draft"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("idx_pages_slug").on(t.slug)]
);
