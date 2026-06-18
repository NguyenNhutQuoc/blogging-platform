import { env } from "./env.js";

/**
 * Sentry-ready error monitoring.
 *
 * Intentionally dependency-light: @sentry/node is NOT a hard dependency. When
 * SENTRY_DSN is set we lazily import it at runtime; if the package isn't
 * installed (or no DSN is configured) every function is a safe no-op. This
 * keeps local/dev/test builds lean while leaving production a one-step upgrade:
 *
 *   pnpm --filter @repo/api add @sentry/node
 *   SENTRY_DSN=https://… in the environment
 *
 * The module specifier is held in a variable so the bundler treats it as a
 * runtime import and does not try to resolve it at build time.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryLike = any;

let sentry: SentryLike | null = null;

/** Initialise monitoring once at process startup. Idempotent + best-effort. */
export async function initObservability(): Promise<void> {
  if (!env.SENTRY_DSN || sentry) return;

  const moduleName = "@sentry/node";
  try {
    const Sentry: SentryLike = await import(moduleName);
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    sentry = Sentry;
    console.log("[observability] Sentry initialised");
  } catch {
    console.warn(
      "[observability] SENTRY_DSN is set but '@sentry/node' is not installed — " +
        "error reporting disabled. Install it to enable: pnpm --filter @repo/api add @sentry/node",
    );
  }
}

/**
 * Report an unexpected error to the monitoring backend.
 * No-op when monitoring is disabled, so it is always safe to call.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) return;
  try {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Never let telemetry failures crash the request/job path.
  }
}

/**
 * Install process-level guards so unhandled async failures in long-running
 * processes (the worker) are reported before the process is allowed to exit.
 */
export function installGlobalErrorHandlers(processName: string): void {
  process.on("unhandledRejection", (reason) => {
    console.error(`[${processName}] Unhandled rejection:`, reason);
    captureException(reason, { processName, kind: "unhandledRejection" });
  });
  process.on("uncaughtException", (err) => {
    console.error(`[${processName}] Uncaught exception:`, err);
    captureException(err, { processName, kind: "uncaughtException" });
  });
}
