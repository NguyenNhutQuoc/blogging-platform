import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers";
import { users } from "./auth";

export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
  "bounced",
  "complained",
]);

export const subscriberSourceEnum = pgEnum("subscriber_source", [
  "signup_form",
  "import",
  "checkout",
]);

export const newsletterStatusEnum = pgEnum("newsletter_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
]);

export const newsletterSendStatusEnum = pgEnum("newsletter_send_status", [
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
]);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: primaryId(),
    email: text("email").notNull().unique(),
    name: text("name"),
    status: subscriberStatusEnum("status").notNull().default("active"),
    source: subscriberSourceEnum("source").notNull().default("signup_form"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow().notNull(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_newsletter_subscribers_email").on(t.email),
    index("idx_newsletter_subscribers_status").on(t.status),
  ]
);

export const newsletters = pgTable(
  "newsletters",
  {
    id: primaryId(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    subject: text("subject").notNull(),
    previewText: text("preview_text"),
    contentHtml: text("content_html").notNull(),
    contentText: text("content_text"),
    status: newsletterStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    statsSent: integer("stats_sent").notNull().default(0),
    statsOpened: integer("stats_opened").notNull().default(0),
    statsClicked: integer("stats_clicked").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("idx_newsletters_status").on(t.status)]
);

export const newsletterSends = pgTable(
  "newsletter_sends",
  {
    id: primaryId(),
    newsletterId: text("newsletter_id")
      .notNull()
      .references(() => newsletters.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    status: newsletterSendStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_newsletter_sends_newsletter").on(t.newsletterId),
    index("idx_newsletter_sends_subscriber").on(t.subscriberId),
  ]
);
