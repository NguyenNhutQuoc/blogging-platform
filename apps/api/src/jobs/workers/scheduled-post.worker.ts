import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import { db } from "../../lib/db.js";
import { posts } from "@repo/database/schema";
import { eq, lte, and } from "drizzle-orm";

/**
 * Scheduled post worker — triggered every minute by the cron job in schedules/.
 * Finds all posts with status='scheduled' and scheduledAt <= now,
 * then transitions them to 'published'.
 *
 * Running this as a job (rather than a DB trigger) gives us:
 * - Retryability if the DB is momentarily unavailable
 * - Audit trail in BullMQ dashboard
 * - Easy to pause/resume from admin
 */
export const scheduledPostWorker = new Worker(
  QUEUE_NAMES.POST_SCHEDULE,
  async () => {
    const now = new Date();

    const duePosts = await db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(
        and(
          eq(posts.status, "scheduled"),
          lte(posts.scheduledAt, now)
        )
      );

    if (duePosts.length === 0) return;

    console.log(`[ScheduledPostWorker] Publishing ${duePosts.length} post(s)`);

    for (const post of duePosts) {
      await db
        .update(posts)
        .set({ status: "published", publishedAt: now, updatedAt: now })
        .where(eq(posts.id, post.id));

      console.log(`[ScheduledPostWorker] Published post: ${post.title} (${post.id})`);
    }
  },
  { connection: redis, concurrency: 1 }
);

scheduledPostWorker.on("failed", (job, err) => {
  console.error(`[ScheduledPostWorker] Job ${job?.id} failed:`, err.message);
});
