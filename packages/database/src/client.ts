import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";

/**
 * Creates a Drizzle database client bound to the given connection URL.
 * Exported as a factory so tests can spin up isolated connections
 * against the test database without touching the main DB singleton.
 */
export function createDbClient(url: string) {
  const sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(sql, { schema, logger: process.env.NODE_ENV === "development" });
}

/** Module-level singleton — avoids multiple pool connections in a single process */
let _db: ReturnType<typeof createDbClient> | null = null;

export function getDb(): ReturnType<typeof createDbClient> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    _db = createDbClient(url);
  }
  return _db;
}
