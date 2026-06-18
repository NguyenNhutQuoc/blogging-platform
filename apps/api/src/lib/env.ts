import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Load .env from the monorepo root before anything reads process.env.
 * Must be at the TOP of this file — env.ts is the first module imported by
 * every other module, so dotenv runs before any env access happens.
 *
 * Why here and not in index.ts:
 *   ESM static imports are hoisted and resolved before top-level code runs.
 *   Calling config() in index.ts is too late — db.ts and redis.ts have
 *   already read process.env by the time index.ts body executes.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
// env.ts lives at: apps/api/src/lib/  →  ../../../../ = monorepo root
config({ path: resolve(__dirname, "../../../../.env"), override: false });

// ─────────────────────────────────────────────────────────────────────────────

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "3003"), 10),
  APP_URL: optionalEnv("APP_URL", "http://localhost:3000"),
  API_URL: optionalEnv("API_URL", "http://localhost:3003"),
  ADMIN_URL: optionalEnv("ADMIN_URL", "http://localhost:3002"),

  DATABASE_URL: optionalEnv("DATABASE_URL", ""),
  DATABASE_TEST_URL: optionalEnv("DATABASE_TEST_URL", ""),
  REDIS_URL: optionalEnv("REDIS_URL", "redis://localhost:6379"),

  BETTER_AUTH_SECRET: optionalEnv(
    "BETTER_AUTH_SECRET",
    "dev-secret-change-in-production",
  ),
  BETTER_AUTH_URL: optionalEnv(
    "BETTER_AUTH_URL",
    "http://localhost:3003/api/v1/auth",
  ),

  S3_ENDPOINT: optionalEnv("S3_ENDPOINT", "http://localhost:9000"),
  S3_REGION: optionalEnv("S3_REGION", "us-east-1"),
  S3_ACCESS_KEY_ID: optionalEnv("S3_ACCESS_KEY_ID", "minioadmin"),
  S3_SECRET_ACCESS_KEY: optionalEnv("S3_SECRET_ACCESS_KEY", "minioadmin"),
  S3_BUCKET_NAME: optionalEnv("S3_BUCKET_NAME", "blog-media"),
  S3_PUBLIC_URL: optionalEnv(
    "S3_PUBLIC_URL",
    "http://localhost:9000/blog-media",
  ),

  RESEND_API_KEY: optionalEnv("RESEND_API_KEY", ""),
  EMAIL_FROM: optionalEnv("EMAIL_FROM", "noreply@localhost"),

  ANALYTICS_SALT: optionalEnv("ANALYTICS_SALT", "dev-salt"),

  LOG_LEVEL: optionalEnv("LOG_LEVEL", "info"),
  /** Error-monitoring DSN. Empty = monitoring disabled (no-op). */
  SENTRY_DSN: optionalEnv("SENTRY_DSN", ""),

  STRIPE_SECRET_KEY: optionalEnv("STRIPE_SECRET_KEY", ""),
  STRIPE_WEBHOOK_SECRET: optionalEnv("STRIPE_WEBHOOK_SECRET", ""),
  STRIPE_PUBLISHABLE_KEY: optionalEnv("STRIPE_PUBLISHABLE_KEY", ""),

  /**
   * Comma-separated list of allowed CORS origins.
   * In production, set this to your exact frontend/admin URLs.
   * Default covers standard local dev ports.
   */
  CORS_ORIGINS: optionalEnv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3002",
  ),

  get isDev() {
    return this.NODE_ENV === "development";
  },
  get isProd() {
    return this.NODE_ENV === "production";
  },
  get isTest() {
    return this.NODE_ENV === "test";
  },
} as const;

/**
 * Fail fast on insecure or missing configuration in production.
 *
 * Runs at module load — because env.ts is the first import in every entry
 * point (index.ts / worker.ts / migrate.ts), a misconfigured container exits
 * immediately with a clear message instead of booting in an unsafe state.
 * Dev and test keep their convenient defaults (this block is skipped).
 */
function validateProductionEnv(): void {
  if (env.NODE_ENV !== "production") return;

  const errors: string[] = [];

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is required in production.");
  }
  if (
    !env.BETTER_AUTH_SECRET ||
    env.BETTER_AUTH_SECRET === "dev-secret-change-in-production" ||
    env.BETTER_AUTH_SECRET.length < 32
  ) {
    errors.push(
      "BETTER_AUTH_SECRET must be set to a unique value of at least 32 characters.",
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `[env] Invalid production configuration:\n  - ${errors.join("\n  - ")}`,
    );
  }

  // Non-fatal hardening warnings — log but allow boot.
  if (env.ANALYTICS_SALT === "dev-salt") {
    console.warn("[env] WARNING: ANALYTICS_SALT is the dev default; set a unique salt.");
  }
  if (/localhost/.test(env.CORS_ORIGINS)) {
    console.warn("[env] WARNING: CORS_ORIGINS still allows localhost in production.");
  }
}

validateProductionEnv();
