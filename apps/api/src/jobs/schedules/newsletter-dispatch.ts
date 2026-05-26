import { newsletterQueue } from "../queues.js";

/**
 * Register the repeatable cron that dispatches scheduled newsletters.
 * Runs every minute — newsletters are sent within 60s of their scheduledAt time.
 * The actual dispatch is handled by the newsletter worker's "dispatch" job type.
 */
export async function registerNewsletterDispatchCron() {
  await newsletterQueue.add(
    "check-scheduled-newsletters",
    { type: "check-due" } as never,
    {
      repeat: { pattern: "* * * * *" },
      jobId: "newsletter-dispatch-cron",
    }
  );
  console.log("[Cron] Registered: newsletter-dispatch (every minute)");
}
