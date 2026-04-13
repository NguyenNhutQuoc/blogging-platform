import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";

/**
 * Queue instances — exported for use in service layer when enqueuing jobs.
 * Workers subscribe to these queues in separate files.
 *
 * All queues share the same Redis connection but operate independently,
 * so a slow newsletter batch doesn't block image processing.
 */
const connection = redis;

/** Transactional emails: welcome, password reset, payment notifications */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

/** Bulk newsletter sends — rate-limited to respect Resend's API limits */
export const newsletterQueue = new Queue(QUEUE_NAMES.NEWSLETTER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 200 },
  },
});

/**
 * Scheduled post publisher — a repeatable cron job checks every minute
 * for posts with scheduledAt <= now and publishes them.
 */
export const postScheduleQueue = new Queue(QUEUE_NAMES.POST_SCHEDULE, {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  },
});

/**
 * Image optimization — resize + convert to WebP/AVIF after upload.
 * Concurrency capped at 2 because sharp is CPU-intensive.
 */
export const imageQueue = new Queue(QUEUE_NAMES.IMAGE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

/** Search index sync — debounced 5s after post save to avoid over-indexing */
export const searchIndexQueue = new Queue(QUEUE_NAMES.SEARCH_INDEX, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

/** Daily analytics aggregation — runs at 03:00 UTC */
export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: { count: 30 },
  },
});
