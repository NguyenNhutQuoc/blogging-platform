import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  newsletterSubscribers,
  newsletters,
  newsletterSends,
} from "@repo/database/schema";
import type {
  NewsletterSubscriber,
  Newsletter,
  NewsletterSend,
} from "@repo/database";

// ─── Subscribers ──────────────────────────────────────────────────────────────

export async function findSubscriberByEmail(
  email: string
): Promise<NewsletterSubscriber | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function findSubscriberByToken(
  token: string,
  type: "confirm" | "unsubscribe"
): Promise<NewsletterSubscriber | null> {
  const col =
    type === "confirm"
      ? newsletterSubscribers.confirmToken
      : newsletterSubscribers.unsubscribeToken;

  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(col, token))
    .limit(1);
  return row ?? null;
}

export async function findSubscriberById(
  id: string
): Promise<NewsletterSubscriber | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .limit(1);
  return row ?? null;
}

export async function findSubscribersByIds(
  ids: string[]
): Promise<NewsletterSubscriber[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(newsletterSubscribers)
    .where(sql`${newsletterSubscribers.id} = ANY(${ids})`);
}

export async function createSubscriber(
  data: typeof newsletterSubscribers.$inferInsert
): Promise<NewsletterSubscriber> {
  const [row] = await db.insert(newsletterSubscribers).values(data).returning();
  return row!;
}

export async function updateSubscriber(
  id: string,
  data: Partial<typeof newsletterSubscribers.$inferInsert>
): Promise<NewsletterSubscriber | null> {
  const [row] = await db
    .update(newsletterSubscribers)
    .set(data)
    .where(eq(newsletterSubscribers.id, id))
    .returning();
  return row ?? null;
}

/**
 * Paginated batch of confirmed active subscribers for newsletter sending.
 * Only includes subscribers who have clicked the confirmation link (confirmToken IS NULL).
 */
export async function listActiveSubscribers(
  offset: number,
  limit: number
): Promise<NewsletterSubscriber[]> {
  return db
    .select()
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "active"),
        sql`${newsletterSubscribers.confirmToken} IS NULL`
      )
    )
    .orderBy(asc(newsletterSubscribers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countActiveSubscribers(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "active"),
        sql`${newsletterSubscribers.confirmToken} IS NULL`
      )
    );
  return row?.total ?? 0;
}

export async function listSubscribers(filter: {
  page: number;
  pageSize: number;
  status?: "active" | "unsubscribed" | "bounced" | "complained";
  q?: string;
}): Promise<{ data: NewsletterSubscriber[]; total: number }> {
  const { page, pageSize, status, q } = filter;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(newsletterSubscribers.status, status));
  if (q) {
    conditions.push(
      or(
        ilike(newsletterSubscribers.email, `%${q}%`),
        ilike(newsletterSubscribers.name, `%${q}%`)
      )
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [data, [countRow]] = await Promise.all([
    db
      .select()
      .from(newsletterSubscribers)
      .where(where)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(newsletterSubscribers).where(where),
  ]);

  return { data, total: countRow?.total ?? 0 };
}

// ─── Newsletters ──────────────────────────────────────────────────────────────

export async function findNewsletterById(
  id: string
): Promise<Newsletter | null> {
  const [row] = await db
    .select()
    .from(newsletters)
    .where(eq(newsletters.id, id))
    .limit(1);
  return row ?? null;
}

export async function createNewsletter(
  data: typeof newsletters.$inferInsert
): Promise<Newsletter> {
  const [row] = await db.insert(newsletters).values(data).returning();
  return row!;
}

export async function updateNewsletter(
  id: string,
  data: Partial<typeof newsletters.$inferInsert>
): Promise<Newsletter | null> {
  const [row] = await db
    .update(newsletters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(newsletters.id, id))
    .returning();
  return row ?? null;
}

export async function listNewsletters(filter: {
  page: number;
  pageSize: number;
  status?: "draft" | "scheduled" | "sending" | "sent";
}): Promise<{ data: Newsletter[]; total: number }> {
  const { page, pageSize, status } = filter;
  const offset = (page - 1) * pageSize;
  const where = status ? eq(newsletters.status, status) : undefined;

  const [data, [countRow]] = await Promise.all([
    db
      .select()
      .from(newsletters)
      .where(where)
      .orderBy(desc(newsletters.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(newsletters).where(where),
  ]);

  return { data, total: countRow?.total ?? 0 };
}

/** Increment stats counters atomically — avoids read-modify-write races. */
export async function incrementNewsletterStats(
  id: string,
  field: "statsSent" | "statsOpened" | "statsClicked"
): Promise<void> {
  const col =
    field === "statsSent"
      ? newsletters.statsSent
      : field === "statsOpened"
        ? newsletters.statsOpened
        : newsletters.statsClicked;

  await db
    .update(newsletters)
    .set({ [field]: sql`${col} + 1` })
    .where(eq(newsletters.id, id));
}

// ─── Newsletter sends ─────────────────────────────────────────────────────────

export async function createNewsletterSend(
  data: typeof newsletterSends.$inferInsert
): Promise<NewsletterSend> {
  const [row] = await db.insert(newsletterSends).values(data).returning();
  return row!;
}

export async function bulkCreateNewsletterSends(
  rows: (typeof newsletterSends.$inferInsert)[]
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(newsletterSends).values(rows);
}

export async function findSendById(id: string): Promise<NewsletterSend | null> {
  const [row] = await db
    .select()
    .from(newsletterSends)
    .where(eq(newsletterSends.id, id))
    .limit(1);
  return row ?? null;
}

export async function findSendByNewsletterAndSubscriber(
  newsletterId: string,
  subscriberId: string
): Promise<NewsletterSend | null> {
  const [row] = await db
    .select()
    .from(newsletterSends)
    .where(
      and(
        eq(newsletterSends.newsletterId, newsletterId),
        eq(newsletterSends.subscriberId, subscriberId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function markSendOpened(id: string): Promise<void> {
  await db
    .update(newsletterSends)
    .set({ status: "opened", openedAt: new Date() })
    .where(
      and(
        eq(newsletterSends.id, id),
        // Only mark once — if already clicked, keep "clicked" (higher state)
        sql`${newsletterSends.status} NOT IN ('clicked')`
      )
    );
}

export async function markSendClicked(id: string): Promise<void> {
  await db
    .update(newsletterSends)
    .set({ status: "clicked", clickedAt: new Date() })
    .where(eq(newsletterSends.id, id));
}

export async function updateSendStatus(
  id: string,
  status: "sent" | "bounced" | "complained",
  sentAt?: Date
): Promise<void> {
  await db
    .update(newsletterSends)
    .set({ status, ...(sentAt && { sentAt }) })
    .where(eq(newsletterSends.id, id));
}

/** Find newsletters that are scheduled and due to be sent. */
export async function findDueScheduledNewsletters(): Promise<Newsletter[]> {
  return db
    .select()
    .from(newsletters)
    .where(
      and(
        eq(newsletters.status, "scheduled"),
        sql`${newsletters.scheduledAt} <= NOW()`
      )
    );
}
