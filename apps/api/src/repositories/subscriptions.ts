import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  subscriptionPlans,
  subscriptions,
  paymentHistory,
  coupons,
} from "@repo/database/schema";
import type {
  SubscriptionPlan,
  Subscription,
  PaymentHistory,
  Coupon,
} from "@repo/database";

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function findPlanById(id: string): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .limit(1);
  return plan ?? null;
}

export async function findPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, slug))
    .limit(1);
  return plan ?? null;
}

export async function listActivePlans(): Promise<SubscriptionPlan[]> {
  return db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function findActiveSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        sql`${subscriptions.status} IN ('active', 'trialing')`
      )
    )
    .limit(1);
  return sub ?? null;
}

export async function findSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return sub ?? null;
}

export async function createSubscription(
  data: typeof subscriptions.$inferInsert
): Promise<Subscription> {
  const [sub] = await db.insert(subscriptions).values(data).returning();
  return sub!;
}

export async function updateSubscription(
  id: string,
  data: Partial<typeof subscriptions.$inferInsert>
): Promise<Subscription | null> {
  const [sub] = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  return sub ?? null;
}

export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: Partial<typeof subscriptions.$inferInsert>
): Promise<Subscription | null> {
  const [sub] = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return sub ?? null;
}

// ─── Payment History ──────────────────────────────────────────────────────────

export async function createPaymentRecord(
  data: typeof paymentHistory.$inferInsert
): Promise<PaymentHistory> {
  const [record] = await db.insert(paymentHistory).values(data).returning();
  return record!;
}

export async function listPaymentsByUserId(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ data: PaymentHistory[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [data, [countRow]] = await Promise.all([
    db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.userId, userId))
      .orderBy(desc(paymentHistory.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentHistory)
      .where(eq(paymentHistory.userId, userId)),
  ]);

  return { data, total: countRow?.count ?? 0 };
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);
  return coupon ?? null;
}

export async function incrementCouponUsage(id: string): Promise<void> {
  await db
    .update(coupons)
    .set({ currentUses: sql`${coupons.currentUses} + 1` })
    .where(eq(coupons.id, id));
}

export async function createCoupon(
  data: typeof coupons.$inferInsert
): Promise<Coupon> {
  const [coupon] = await db.insert(coupons).values(data).returning();
  return coupon!;
}

export async function updateCoupon(
  id: string,
  data: Partial<typeof coupons.$inferInsert>
): Promise<Coupon | null> {
  const [coupon] = await db
    .update(coupons)
    .set(data)
    .where(eq(coupons.id, id))
    .returning();
  return coupon ?? null;
}

export async function listCoupons(isActive?: boolean): Promise<Coupon[]> {
  const conditions = isActive !== undefined
    ? [eq(coupons.isActive, isActive)]
    : [];

  return db
    .select()
    .from(coupons)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(coupons.createdAt));
}
