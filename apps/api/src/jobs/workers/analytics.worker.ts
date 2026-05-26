import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import { deleteOldPageViews } from "../../repositories/analytics.js";

/**
 * Daily analytics maintenance — runs at 03:00 UTC.
 * Purges raw page_view rows older than 90 days (GDPR/storage hygiene).
 * Dashboard queries run on-demand against the remaining rows.
 */
export const analyticsWorker = new Worker(
  QUEUE_NAMES.ANALYTICS,
  async (_job) => {
    console.log("[AnalyticsWorker] Starting daily maintenance...");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const deleted = await deleteOldPageViews(cutoff);
    console.log(`[AnalyticsWorker] Deleted ${deleted} page views older than 90 days`);

    console.log("[AnalyticsWorker] Daily maintenance complete");
  },
  { connection: redis, concurrency: 1 }
);

analyticsWorker.on("failed", (job, err) => {
  console.error(`[AnalyticsWorker] Job ${job?.id} failed:`, err.message);
});
