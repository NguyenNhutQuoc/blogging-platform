import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";

/**
 * Analytics aggregation worker — runs daily at 03:00 UTC.
 * Rolls up raw page_view rows into pre-aggregated stats for the dashboard.
 * Pre-aggregation keeps dashboard queries fast even with millions of raw rows.
 */
export const analyticsWorker = new Worker(
  QUEUE_NAMES.ANALYTICS,
  async (job) => {
    console.log("[AnalyticsWorker] Starting daily aggregation...");

    // TODO Phase 4: implement aggregation queries
    // - Sum page views per post per day
    // - Compute unique visitors per day
    // - Aggregate by country / device_type
    // - Store results in a summary table

    console.log("[AnalyticsWorker] Daily aggregation complete");
  },
  { connection: redis, concurrency: 1 }
);

analyticsWorker.on("failed", (job, err) => {
  console.error(`[AnalyticsWorker] Job ${job?.id} failed:`, err.message);
});
