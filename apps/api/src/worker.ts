/**
 * Standalone worker process entry point — used in production to run workers
 * in a separate container from the API server.
 *
 * Usage: node dist/worker.ts
 * Docker: add a second service in docker-compose.prod.yml pointing to this entry point.
 *
 * Workers are horizontally scalable independently from the API server,
 * which is useful when image processing or newsletter sending spikes.
 */
// env.ts loads dotenv at module init — must be the first import
import "./lib/env.js";
import { registerPublishScheduledCron } from "./jobs/schedules/publish-scheduled.js";
import { registerAnalyticsRollupCron } from "./jobs/schedules/analytics-rollup.js";

// Import workers to register them with BullMQ
await import("./jobs/workers/index.js");

// Register cron jobs (idempotent — safe to call on every restart)
await registerPublishScheduledCron();
await registerAnalyticsRollupCron();

console.log("🔧 Worker process started");
console.log("   - Email worker: active");
console.log("   - Image worker: active");
console.log("   - Scheduled post worker: active");
console.log("   - Search index worker: active");
console.log("   - Analytics worker: active");
console.log("   - Crons: publish-scheduled (1m), analytics-rollup (daily 03:00 UTC)");
