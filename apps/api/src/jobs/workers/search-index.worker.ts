import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import { db } from "../../lib/db.js";
import { posts } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface SearchIndexJobData {
  postId: string;
  action: "index" | "delete";
}

/**
 * Search index worker — syncs post content to the PostgreSQL tsvector column.
 * Using a job (not a DB trigger) gives us control over when indexing happens
 * and lets us debounce rapid edits during drafting.
 *
 * The tsvector combines title (weight A), excerpt (weight B), and content (weight C).
 * Phase 5+: swap this worker to push to Meilisearch instead.
 */
export const searchIndexWorker = new Worker<SearchIndexJobData>(
  QUEUE_NAMES.SEARCH_INDEX,
  async (job) => {
    const { postId, action } = job.data;

    if (action === "delete") {
      await db
        .update(posts)
        .set({ searchVector: sql`NULL` })
        .where(eq(posts.id, postId));
      return;
    }

    // Build tsvector from title (A), excerpt (B), and stripped HTML content (C)
    await db.execute(sql`
      UPDATE posts
      SET search_vector = (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(regexp_replace(content, '<[^>]+>', ' ', 'g'), '')), 'C')
      )
      WHERE id = ${postId}
    `);

    console.log(`[SearchIndexWorker] Indexed post ${postId}`);
  },
  { connection: redis, concurrency: 3 }
);

searchIndexWorker.on("failed", (job, err) => {
  console.error(`[SearchIndexWorker] Job ${job?.id} failed:`, err.message);
});
