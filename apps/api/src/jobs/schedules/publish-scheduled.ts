import { postScheduleQueue } from "../queues.js";

/**
 * Register the repeatable cron job that checks for scheduled posts.
 * Runs every minute — posts are published within 60s of their scheduledAt time.
 *
 * This is called once at startup (from worker entry point).
 * BullMQ stores the repeatable job in Redis so it survives process restarts.
 */
export async function registerPublishScheduledCron() {
  await postScheduleQueue.add(
    "check-scheduled-posts",
    {},
    {
      repeat: { pattern: "* * * * *" }, // every minute
      jobId: "publish-scheduled-cron",  // stable ID prevents duplicate registration
    }
  );
  console.log("[Cron] Registered: publish-scheduled (every minute)");
}
