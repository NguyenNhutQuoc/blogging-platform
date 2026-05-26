import crypto from "crypto";
import { redis } from "../lib/redis.js";
import { env } from "../lib/env.js";
import * as repo from "../repositories/analytics.js";
import type {
  TrackPageViewInput,
  TrackReactionInput,
  TrackReadingProgressInput,
  AnalyticsQueryInput,
  PostAnalyticsQueryInput,
} from "@repo/validators/analytics";
import type { OverviewStats, PostStats } from "../repositories/analytics.js";

// ─── Real-time visitor tracking ───────────────────────────────────────────────

const REALTIME_KEY = "analytics:realtime:visitors";
const REALTIME_WINDOW_SECONDS = 300; // 5 minutes

async function touchVisitor(visitorId: string): Promise<void> {
  const now = Date.now();
  await redis.zadd(REALTIME_KEY, now, visitorId);
  // Prune stale entries outside the 5-minute window
  await redis.zremrangebyscore(REALTIME_KEY, 0, now - REALTIME_WINDOW_SECONDS * 1000);
  // Auto-expire the key so it doesn't linger after traffic stops
  await redis.expire(REALTIME_KEY, REALTIME_WINDOW_SECONDS * 2);
}

export async function getRealtimeVisitors(): Promise<number> {
  const cutoff = Date.now() - REALTIME_WINDOW_SECONDS * 1000;
  return redis.zcount(REALTIME_KEY, cutoff, "+inf");
}

// ─── Visitor fingerprint ──────────────────────────────────────────────────────

export function buildVisitorId(ip: string, userAgent: string): string {
  return crypto
    .createHmac("sha256", env.ANALYTICS_SALT)
    .update(`${ip}:${userAgent}`)
    .digest("hex");
}

// ─── Page views ───────────────────────────────────────────────────────────────

export async function trackPageView(
  input: TrackPageViewInput,
  meta: { ip: string; userAgent: string; country?: string; city?: string; deviceType?: string; browser?: string; os?: string }
): Promise<void> {
  const visitorId = buildVisitorId(meta.ip, meta.userAgent);

  await Promise.all([
    repo.insertPageView({
      postId: input.postId ?? null,
      sessionId: input.sessionId,
      visitorId,
      path: input.path,
      referrer: input.referrer ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      country: meta.country ?? null,
      city: meta.city ?? null,
      deviceType: meta.deviceType ?? null,
      browser: meta.browser ?? null,
      os: meta.os ?? null,
    }),
    touchVisitor(visitorId),
  ]);
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function trackReaction(
  input: TrackReactionInput,
  userId?: string
): Promise<void> {
  await repo.upsertReaction({
    postId: input.postId,
    userId: userId ?? null,
    sessionId: input.sessionId,
    reactionType: input.reactionType,
  });
}

export async function getReactionCounts(
  postId: string
): Promise<Record<string, number>> {
  return repo.getReactionCounts(postId);
}

// ─── Reading progress ─────────────────────────────────────────────────────────

export async function trackReadingProgress(
  input: TrackReadingProgressInput,
  userId?: string
): Promise<void> {
  await repo.upsertReadingProgress({
    postId: input.postId,
    userId: userId ?? null,
    sessionId: input.sessionId,
    scrollDepthPercent: input.scrollDepthPercent,
    timeSpentSeconds: input.timeSpentSeconds,
    finishedReading: input.finishedReading,
  });
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getOverviewStats(
  query: AnalyticsQueryInput
): Promise<OverviewStats & { realtimeVisitors: number }> {
  const [stats, realtimeVisitors] = await Promise.all([
    repo.getOverviewStats({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    }),
    getRealtimeVisitors(),
  ]);

  return { ...stats, realtimeVisitors };
}

export async function getPostAnalytics(
  postId: string,
  query: PostAnalyticsQueryInput
): Promise<PostStats> {
  return repo.getPostStats(postId, {
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
  });
}
