import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * Shared Redis client used for:
 * - BullMQ job queues
 * - API response caching
 * - Rate limiting counters
 *
 * A single connection is reused across the process to avoid hitting
 * Redis connection limits in production.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  // Log but don't crash — Redis being down degrades gracefully (cache miss)
  console.error("[Redis] Connection error:", err.message);
});
