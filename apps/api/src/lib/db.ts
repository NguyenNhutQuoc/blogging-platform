import { createDbClient } from "@repo/database/client";
import { env } from "./env.js";

/**
 * Singleton DB client for the API process.
 * Tests override DATABASE_URL via env before importing this module.
 */
const url = env.DATABASE_URL || env.DATABASE_TEST_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export const db = createDbClient(url);
