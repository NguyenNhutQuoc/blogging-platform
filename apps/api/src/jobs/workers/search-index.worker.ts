import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import { db } from "../../lib/db.js";
import { posts } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface SearchIndexJobData {
  postId: string;
  /**
   * Only "delete" is dispatched by the posts service.
   * Indexing (insert/update) is handled automatically by the PostgreSQL
   * tsvector trigger defined in migrations/0001_fts_gin_index.sql — no need
   * to re-run the same SQL from a worker on every save.
   *
   * Phase 5+: add "index" back here to push to Meilisearch instead of the trigger.
   */
  action: "delete";
}

/**
 * Search index worker — handles soft-delete cleanup for the tsvector column.
 *
 * Indexing (INSERT/UPDATE) is handled automatically by the PostgreSQL trigger
 * `posts_search_vector_update` — we do NOT dispatch index jobs from the posts
 * service to avoid running duplicate SQL on every save.
 *
 * This worker only clears the search_vector when a post is soft-deleted so that
 * deleted posts are immediately removed from search results without waiting for
 * the trigger (which only fires on UPDATE of tracked columns).
 *
 * Phase 5+: extend to push to Meilisearch — swap trigger for this worker.
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
      console.log(`[SearchIndexWorker] Cleared search vector for deleted post ${postId}`);
      return;
    }
  },
  { connection: redis, concurrency: 3 }
);

searchIndexWorker.on("failed", (job, err) => {
  console.error(`[SearchIndexWorker] Job ${job?.id} failed:`, err.message);
});
