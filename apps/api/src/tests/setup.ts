import { afterEach, afterAll } from "vitest";
import { createDbClient } from "@repo/database/client";
import { sql } from "drizzle-orm";

/**
 * Test database setup:
 * - Connects to the dedicated test DB (blog_platform_test on port 5433)
 * - Truncates all tables between tests for isolation
 * - Does NOT run migrations here — run `pnpm db:migrate` against the test DB manually
 *   or in CI before running tests.
 *
 * If no test DB is reachable (e.g. running unit tests locally without Docker),
 * the truncation is skipped so mocked tests still pass.
 */
const TEST_DB_URL =
  process.env.DATABASE_TEST_URL ??
  "postgresql://postgres:postgres@localhost:5433/blog_platform_test";

// Override the API's DB connection before any module is imported
process.env.DATABASE_URL = TEST_DB_URL;
process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_SECRET = "test-secret-32-chars-minimum-xx";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const testDb = createDbClient(TEST_DB_URL);

/**
 * Ordered list — children first so CASCADE isn't needed, but we add it anyway
 * for safety in case FK dependencies change.
 */
const TRUNCATE_TABLES = [
  "revisions",
  "post_tags",
  "post_categories",
  "series_posts",
  "analytics_reading_progress",
  "analytics_post_reactions",
  "analytics_page_views",
  "newsletter_sends",
  "billing_payment_history",
  "billing_subscriptions",
  "comments",
  "media",
  "posts",
  "series",
  "tags",
  "categories",
  "newsletters",
  "newsletter_subscribers",
  "billing_coupons",
  "billing_subscription_plans",
  "audit_logs",
  "redirects",
  "pages",
  "site_settings",
  "verification_tokens",
  "accounts",
  "sessions",
  "users",
];

afterEach(async () => {
  /**
   * Skip truncation if the test DB is unreachable.
   * This allows mocked unit tests (e.g. health.test.ts) to run locally
   * without requiring Docker to be running.
   * Integration tests that actually write to the DB will fail naturally
   * if the DB is unavailable, which is the desired behaviour.
   */
  try {
    for (const table of TRUNCATE_TABLES) {
      await testDb.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
    }
  } catch {
    // DB not available — mocked tests will still pass
  }
});

afterAll(async () => {
  // postgres.js manages pool lifecycle — no explicit close needed
});
