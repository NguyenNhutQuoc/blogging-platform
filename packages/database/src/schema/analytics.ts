import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { primaryId } from "./helpers";
import { posts } from "./content";
import { users } from "./auth";

export const reactionTypeEnum = pgEnum("reaction_type", [
  "like",
  "love",
  "insightful",
  "bookmark",
]);

export const pageViews = pgTable(
  "analytics_page_views",
  {
    id: primaryId(),
    postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
    sessionId: text("session_id").notNull(),
    /**
     * Hashed visitor fingerprint (IP + UA + salt) — no PII stored.
     * GDPR-friendly: we track unique visitors without cookies or personal data.
     */
    visitorId: text("visitor_id").notNull(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    country: text("country"),
    city: text("city"),
    deviceType: text("device_type"),
    browser: text("browser"),
    os: text("os"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_page_views_post_date").on(t.postId, t.createdAt),
    index("idx_page_views_session").on(t.sessionId, t.createdAt),
    index("idx_page_views_visitor").on(t.visitorId),
  ]
);

export const postReactions = pgTable(
  "analytics_post_reactions",
  {
    id: primaryId(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Null for anonymous reactions */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    reactionType: reactionTypeEnum("reaction_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_post_reactions_post").on(t.postId, t.reactionType)]
);

export const readingProgress = pgTable(
  "analytics_reading_progress",
  {
    id: primaryId(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: text("session_id").notNull(),
    scrollDepthPercent: integer("scroll_depth_percent").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    finishedReading: boolean("finished_reading").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_reading_progress_post").on(t.postId)]
);
