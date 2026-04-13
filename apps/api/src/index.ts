// env.ts loads dotenv at module init — must be the first import
import { env } from "./lib/env.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Start BullMQ workers in the same process (dev mode)
// In production, run workers separately via: node dist/worker.js
if (env.isDev) {
  await import("./jobs/workers/index.js");
}

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`🚀 API running at http://localhost:${info.port}`);
    console.log(`📖 API docs at http://localhost:${info.port}/api/docs`);
    console.log(`📄 OpenAPI spec at http://localhost:${info.port}/api/v1/openapi.json`);
  }
);
