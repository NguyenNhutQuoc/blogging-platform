/** Pagination defaults — kept low to avoid over-fetching on first render */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Post revision history limit — older revisions are pruned automatically */
export const MAX_REVISIONS_PER_POST = 50;

/** Reading speed used to compute estimated reading time */
export const WORDS_PER_MINUTE = 200;

/** Auto-save interval for the blog editor (ms) */
export const EDITOR_AUTOSAVE_INTERVAL_MS = 30_000;

/** BullMQ queue names — single source of truth shared by API and workers */
export const QUEUE_NAMES = {
  EMAIL: "email-queue",
  NEWSLETTER: "newsletter-queue",
  POST_SCHEDULE: "post-schedule-queue",
  IMAGE: "image-queue",
  SEARCH_INDEX: "search-index-queue",
  ANALYTICS: "analytics-queue",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
