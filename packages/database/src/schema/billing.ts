import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers";
import { users } from "./auth";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "paused",
]);

export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "failed",
  "refunded",
]);

export const subscriptionPlans = pgTable("billing_subscription_plans", {
  id: primaryId(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  priceMonthyCents: integer("price_monthly_cents").notNull().default(0),
  priceYearlyCents: integer("price_yearly_cents").notNull().default(0),
  /** Features shown on the pricing page (array of feature strings) */
  features: jsonb("features"),
  /** Usage limits per plan e.g. { "storage_mb": 1000 } */
  limits: jsonb("limits"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const subscriptions = pgTable(
  "billing_subscriptions",
  {
    id: primaryId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeCustomerId: text("stripe_customer_id"),
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId, t.status),
    uniqueIndex("idx_subscriptions_stripe").on(t.stripeSubscriptionId),
  ]
);

export const paymentHistory = pgTable(
  "billing_payment_history",
  {
    id: primaryId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatusEnum("status").notNull(),
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_payment_history_user").on(t.userId)]
);

export const coupons = pgTable("billing_coupons", {
  id: primaryId(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").notNull().default(0),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
