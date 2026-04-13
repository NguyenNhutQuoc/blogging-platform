import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { db } from "../../lib/db.js";
import { redis } from "../../lib/redis.js";
import { sql } from "drizzle-orm";

const router = new OpenAPIHono();

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  timestamp: z.string(),
  services: z.object({
    database: z.enum(["ok", "error"]),
    redis: z.enum(["ok", "error"]),
  }),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  description: "Returns the health status of the API and its dependencies.",
  responses: {
    200: {
      content: { "application/json": { schema: healthResponseSchema } },
      description: "Service is healthy",
    },
    503: {
      content: { "application/json": { schema: healthResponseSchema } },
      description: "Service is degraded",
    },
  },
});

router.openapi(healthRoute, async (c) => {
  let dbStatus: "ok" | "error" = "ok";
  let redisStatus: "ok" | "error" = "ok";

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = "error";
  }

  const allOk = dbStatus === "ok" && redisStatus === "ok";
  const body = {
    status: allOk ? ("ok" as const) : ("degraded" as const),
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    services: { database: dbStatus, redis: redisStatus },
  };

  return c.json(body, allOk ? 200 : 503);
});

export { router as healthRouter };
