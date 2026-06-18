// env.ts loads dotenv at module init — must be the first import
import { env } from "./lib/env.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/**
 * Production migration runner.
 *
 * Runs from the compiled bundle (`node dist/migrate.js`) so production images
 * don't need drizzle-kit (a dev-only dependency). It applies the journaled
 * Drizzle migrations, then the custom non-journaled FTS migration that
 * drizzle-kit can't generate (GIN index + tsvector trigger).
 *
 * The migrations directory is copied into the image next to the bundle; its
 * location can be overridden with MIGRATIONS_DIR for non-Docker runs.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? resolve(__dirname, "migrations");

async function runMigrations(): Promise<void> {
  const url = env.DATABASE_URL || env.DATABASE_TEST_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  console.log(`[migrate] Using migrations from: ${migrationsFolder}`);

  // A dedicated short-lived connection (max: 1) — migrations run sequentially.
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  try {
    console.log("[migrate] Applying journaled migrations…");
    await migrate(db, { migrationsFolder });

    // The FTS GIN index + tsvector trigger live in a custom .sql file that is
    // not in the Drizzle journal. It is fully idempotent (IF NOT EXISTS /
    // CREATE OR REPLACE), so it is safe to re-run on every deploy.
    const ftsPath = resolve(migrationsFolder, "0001_fts_gin_index.sql");
    if (existsSync(ftsPath)) {
      console.log("[migrate] Applying custom FTS migration…");
      await sql.unsafe(readFileSync(ftsPath, "utf8"));
    } else {
      console.warn(`[migrate] FTS migration not found at ${ftsPath} — skipping`);
    }

    console.log("[migrate] ✅ Migrations complete.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

runMigrations().catch((err) => {
  console.error("[migrate] ❌ Migration failed:", err);
  process.exit(1);
});
