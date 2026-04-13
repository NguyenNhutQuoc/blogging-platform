import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { primaryId, timestamps, softDelete } from "./helpers";
import { users } from "./auth";

/**
 * PostgreSQL tsvector type for full-text search.
 * The column is populated via a DB trigger on INSERT/UPDATE.
 * See migrations for the trigger definition.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "scheduled",
  "archived",
]);

export const postVisibilityEnum = pgEnum("post_visibility", ["free", "pro", "premium"]);

export const posts = pgTable(
  "posts",
  {
    id: primaryId(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    /** HTML output from Tiptap — rendered directly for readers */
    content: text("content").notNull().default(""),
    /** ProseMirror JSON state — loaded back into Tiptap editor when editing */
    contentJson: jsonb("content_json"),
    coverImageUrl: text("cover_image_url"),
    status: postStatusEnum("status").notNull().default("draft"),
    visibility: postVisibilityEnum("visibility").notNull().default("free"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** Computed from wordCount / 200wpm on save — avoids runtime recalculation */
    readingTimeMinutes: integer("reading_time_minutes"),
    wordCount: integer("word_count"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoCanonicalUrl: text("seo_canonical_url"),
    ogImageUrl: text("og_image_url"),
    /** GIN-indexed tsvector — updated on save via service layer */
    searchVector: tsvector("search_vector"),
    metadata: jsonb("metadata"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("idx_posts_slug").on(t.slug),
    index("idx_posts_status_published").on(t.status, t.publishedAt),
    index("idx_posts_author").on(t.authorId, t.status, t.publishedAt),
    index("idx_posts_visibility").on(t.visibility, t.status),
    // Partial index — only index posts awaiting scheduled publish
    index("idx_posts_scheduled").on(t.scheduledAt).where(sql`status = 'scheduled'`),
    // GIN index for FTS — created as raw SQL in the migration file
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Self-referential FK for hierarchical categories (parent → children) */
    parentId: text("parent_id"),
    coverImageUrl: text("cover_image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("idx_categories_slug").on(t.slug)]
);

export const tags = pgTable(
  "tags",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idx_tags_slug").on(t.slug)]
);

/** Many-to-many: posts ↔ tags */
export const postTags = pgTable(
  "post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_post_tags_post").on(t.postId),
    index("idx_post_tags_tag").on(t.tagId),
  ]
);

/** Many-to-many: posts ↔ categories */
export const postCategories = pgTable(
  "post_categories",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_post_categories_post").on(t.postId),
    index("idx_post_categories_category").on(t.categoryId),
  ]
);

export const commentStatusEnum = pgEnum("comment_status", [
  "pending",
  "approved",
  "spam",
  "deleted",
]);

export const comments = pgTable(
  "comments",
  {
    id: primaryId(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Null for guest comments */
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Self-referential for threaded replies — max 3 levels enforced in service */
    parentId: text("parent_id"),
    content: text("content").notNull(),
    status: commentStatusEnum("status").notNull().default("pending"),
    /** Guest commenter fields — populated only when authorId is null */
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("idx_comments_post").on(t.postId, t.status, t.createdAt),
    index("idx_comments_parent").on(t.parentId),
    index("idx_comments_author").on(t.authorId),
  ]
);

export const media = pgTable(
  "media",
  {
    id: primaryId(),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** S3/R2 object key — combine with S3_PUBLIC_URL env var to get the full URL */
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    folder: text("folder"),
    /** EXIF data, image metadata from sharp processing */
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (t) => [
    index("idx_media_uploader").on(t.uploaderId),
    index("idx_media_folder").on(t.folder),
  ]
);

export const revisions = pgTable(
  "revisions",
  {
    id: primaryId(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    editorId: text("editor_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    contentJson: jsonb("content_json"),
    revisionNumber: integer("revision_number").notNull(),
    changeSummary: text("change_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_revisions_post").on(t.postId, t.revisionNumber)]
);

export const seriesStatusEnum = pgEnum("series_status", ["ongoing", "completed"]);

export const series = pgTable(
  "series",
  {
    id: primaryId(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    status: seriesStatusEnum("status").notNull().default("ongoing"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("idx_series_slug").on(t.slug)]
);

export const seriesPosts = pgTable(
  "series_posts",
  {
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    orderInSeries: integer("order_in_series").notNull(),
  },
  (t) => [index("idx_series_posts_series").on(t.seriesId)]
);
