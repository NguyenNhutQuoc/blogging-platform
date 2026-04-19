export * from "./schema/index";
export * from "./client";

// ─── Inferred types — select (read) ──────────────────────────────────────────
// Use these when returning rows from DB queries.

import type {
  users,
  sessions,
  accounts,
} from "./schema/auth";

import type {
  posts,
  categories,
  tags,
  postTags,
  postCategories,
  comments,
  media,
  revisions,
  series,
  seriesPosts,
} from "./schema/content";

import type {
  subscriptionPlans,
  subscriptions,
  paymentHistory,
} from "./schema/billing";

import type {
  newsletterSubscribers,
  newsletters,
  newsletterSends,
} from "./schema/newsletter";

import type { siteSettings, pages, auditLogs } from "./schema/system";

/** Auth */
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;

/** Content */
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type PostTag = typeof postTags.$inferSelect;
export type PostCategory = typeof postCategories.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Revision = typeof revisions.$inferSelect;
export type Series = typeof series.$inferSelect;
export type SeriesPost = typeof seriesPosts.$inferSelect;

/** Billing */
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type PaymentHistory = typeof paymentHistory.$inferSelect;

/** Newsletter */
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type Newsletter = typeof newsletters.$inferSelect;
export type NewsletterSend = typeof newsletterSends.$inferSelect;

/** System */
export type SiteSetting = typeof siteSettings.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// ─── Inferred types — insert (write) ─────────────────────────────────────────
// Use these for INSERT parameters (id/timestamps are optional).

export type NewUser = typeof users.$inferInsert;
export type NewPost = typeof posts.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;
export type NewTag = typeof tags.$inferInsert;
export type NewComment = typeof comments.$inferInsert;
export type NewMedia = typeof media.$inferInsert;
export type NewRevision = typeof revisions.$inferInsert;
export type NewSeries = typeof series.$inferInsert;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
