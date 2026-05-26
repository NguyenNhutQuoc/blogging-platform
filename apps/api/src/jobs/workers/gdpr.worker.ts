import { Worker } from "bullmq";
import { db } from "../../lib/db.js";
import { users, posts, comments, sessions } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";

export type GdprJobData =
  | { type: "hard-delete"; userId: string };

export const gdprWorker = new Worker<GdprJobData>(
  QUEUE_NAMES.GDPR,
  async (job) => {
    const { data } = job;

    if (data.type === "hard-delete") {
      await handleHardDelete(data.userId);
    }
  },
  { connection: redis, concurrency: 1 }
);

async function handleHardDelete(userId: string): Promise<void> {
  console.log(`[GdprWorker] Hard-deleting user ${userId}`);

  // Delete in FK-safe order: sessions → comments → posts → user
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(comments).where(eq(comments.authorId, userId));

  // Soft-deleted posts become orphaned — nullify author rather than cascade
  await db.update(posts).set({ authorId: "deleted" }).where(eq(posts.authorId, userId));

  await db.delete(users).where(eq(users.id, userId));
  console.log(`[GdprWorker] Hard-delete complete for user ${userId}`);
}

gdprWorker.on("failed", (job, err) => {
  console.error(`[GdprWorker] Job ${job?.id} failed:`, err);
});
