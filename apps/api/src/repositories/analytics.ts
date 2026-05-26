import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { pageViews, postReactions, readingProgress } from "@repo/database/schema";
import type { PageView, PostReaction, ReadingProgress } from "@repo/database";

// ─── Page views ───────────────────────────────────────────────────────────────

export async function insertPageView(
  data: typeof pageViews.$inferInsert
): Promise<PageView> {
  const [row] = await db.insert(pageViews).values(data).returning();
  return row!;
}

export async function deleteOldPageViews(olderThan: Date): Promise<number> {
  const [countRow] = await db
    .select({ total: count() })
    .from(pageViews)
    .where(lte(pageViews.createdAt, olderThan));

  const total = countRow?.total ?? 0;
  if (total > 0) {
    await db.delete(pageViews).where(lte(pageViews.createdAt, olderThan));
  }
  return total;
}

// ─── Reading progress ─────────────────────────────────────────────────────────

export async function upsertReadingProgress(
  data: typeof readingProgress.$inferInsert
): Promise<ReadingProgress> {
  const existing = await db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.postId, data.postId),
        eq(readingProgress.sessionId, data.sessionId)
      )
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(readingProgress)
      .set({
        scrollDepthPercent: sql`GREATEST(${readingProgress.scrollDepthPercent}, ${data.scrollDepthPercent})`,
        timeSpentSeconds: sql`${readingProgress.timeSpentSeconds} + ${data.timeSpentSeconds}`,
        finishedReading: sql`${readingProgress.finishedReading} OR ${data.finishedReading ?? false}`,
        updatedAt: new Date(),
      })
      .where(eq(readingProgress.id, existing[0].id))
      .returning();
    return updated!;
  }

  const [row] = await db.insert(readingProgress).values(data).returning();
  return row!;
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function upsertReaction(data: {
  postId: string;
  userId?: string | null;
  sessionId: string;
  reactionType: "like" | "love" | "insightful" | "bookmark";
}): Promise<PostReaction> {
  // One reaction per (post, session, type) — insert or do nothing and return
  const [row] = await db
    .insert(postReactions)
    .values({
      postId: data.postId,
      userId: data.userId ?? null,
      reactionType: data.reactionType,
    })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  // Already existed — return it
  const [existing] = await db
    .select()
    .from(postReactions)
    .where(
      and(
        eq(postReactions.postId, data.postId),
        eq(postReactions.reactionType, data.reactionType),
        data.userId
          ? eq(postReactions.userId, data.userId)
          : sql`${postReactions.userId} IS NULL`
      )
    )
    .limit(1);
  return existing!;
}

export async function getReactionCounts(
  postId: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({ type: postReactions.reactionType, total: count() })
    .from(postReactions)
    .where(eq(postReactions.postId, postId))
    .groupBy(postReactions.reactionType);

  return Object.fromEntries(rows.map((r) => [r.type, r.total]));
}

// ─── Overview stats ───────────────────────────────────────────────────────────

export type OverviewStats = {
  totalViews: number;
  uniqueVisitors: number;
  totalReactions: number;
  topPosts: { postId: string | null; path: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  viewsByDay: { date: string; views: number }[];
};

export async function getOverviewStats(opts: {
  startDate?: Date;
  endDate?: Date;
}): Promise<OverviewStats> {
  const conditions = [];
  if (opts.startDate) conditions.push(gte(pageViews.createdAt, opts.startDate));
  if (opts.endDate) conditions.push(lte(pageViews.createdAt, opts.endDate));
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalViewsRow] = await db
    .select({ total: count() })
    .from(pageViews)
    .where(where);

  const [uniqueVisitorsRow] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${pageViews.visitorId})` })
    .from(pageViews)
    .where(where);

  const [totalReactionsRow] = await db
    .select({ total: count() })
    .from(postReactions);

  const topPosts = await db
    .select({
      postId: pageViews.postId,
      path: pageViews.path,
      views: count(),
    })
    .from(pageViews)
    .where(where)
    .groupBy(pageViews.postId, pageViews.path)
    .orderBy(desc(count()))
    .limit(10);

  const topReferrersRaw = await db
    .select({ referrer: pageViews.referrer, views: count() })
    .from(pageViews)
    .where(and(where, sql`${pageViews.referrer} IS NOT NULL`))
    .groupBy(pageViews.referrer)
    .orderBy(desc(count()))
    .limit(10);

  const viewsByDay = await db
    .select({
      date: sql<string>`DATE(${pageViews.createdAt})::text`,
      views: count(),
    })
    .from(pageViews)
    .where(where)
    .groupBy(sql`DATE(${pageViews.createdAt})`)
    .orderBy(sql`DATE(${pageViews.createdAt})`);

  return {
    totalViews: totalViewsRow?.total ?? 0,
    uniqueVisitors: Number(uniqueVisitorsRow?.total ?? 0),
    totalReactions: totalReactionsRow?.total ?? 0,
    topPosts: topPosts.map((r) => ({ postId: r.postId, path: r.path, views: r.views })),
    topReferrers: topReferrersRaw
      .filter((r) => r.referrer !== null)
      .map((r) => ({ referrer: r.referrer!, views: r.views })),
    viewsByDay: viewsByDay.map((r) => ({ date: r.date, views: r.views })),
  };
}

// ─── Per-post stats ───────────────────────────────────────────────────────────

export type PostStats = {
  totalViews: number;
  uniqueVisitors: number;
  avgScrollDepth: number;
  finishedReadingCount: number;
  avgTimeSpentSeconds: number;
  reactions: Record<string, number>;
};

export async function getPostStats(
  postId: string,
  opts: { startDate?: Date; endDate?: Date }
): Promise<PostStats> {
  const viewConditions = [eq(pageViews.postId, postId)];
  if (opts.startDate) viewConditions.push(gte(pageViews.createdAt, opts.startDate));
  if (opts.endDate) viewConditions.push(lte(pageViews.createdAt, opts.endDate));

  const [viewRow] = await db
    .select({
      total: count(),
      unique: sql<number>`COUNT(DISTINCT ${pageViews.visitorId})`,
    })
    .from(pageViews)
    .where(and(...viewConditions));

  const [progressRow] = await db
    .select({
      avgScroll: sql<number>`AVG(${readingProgress.scrollDepthPercent})`,
      finished: sql<number>`SUM(CASE WHEN ${readingProgress.finishedReading} THEN 1 ELSE 0 END)`,
      avgTime: sql<number>`AVG(${readingProgress.timeSpentSeconds})`,
    })
    .from(readingProgress)
    .where(eq(readingProgress.postId, postId));

  const reactions = await getReactionCounts(postId);

  return {
    totalViews: viewRow?.total ?? 0,
    uniqueVisitors: Number(viewRow?.unique ?? 0),
    avgScrollDepth: Math.round(Number(progressRow?.avgScroll ?? 0)),
    finishedReadingCount: Number(progressRow?.finished ?? 0),
    avgTimeSpentSeconds: Math.round(Number(progressRow?.avgTime ?? 0)),
    reactions,
  };
}
