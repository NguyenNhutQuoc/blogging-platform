import { analyticsQueue } from "../queues.js";

/**
 * Register the daily analytics aggregation cron.
 * Runs at 03:00 UTC — off-peak to avoid DB contention with user traffic.
 */
export async function registerAnalyticsRollupCron() {
  await analyticsQueue.add(
    "daily-analytics-rollup",
    {},
    {
      repeat: { pattern: "0 3 * * *" }, // 03:00 UTC daily
      jobId: "analytics-rollup-cron",
    }
  );
  console.log("[Cron] Registered: analytics-rollup (daily 03:00 UTC)");
}
