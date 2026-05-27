import { describe, it, expect, vi } from "vitest";
import { app } from "../app.js";

// Mock DB and Redis so health tests don't require a live connection
vi.mock("../lib/db.js", () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../lib/redis.js", () => {
  const pipelineMock = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcount: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
  };
  return {
    redis: {
      ping: vi.fn().mockResolvedValue("PONG"),
      pipeline: vi.fn().mockReturnValue(pipelineMock),
    },
  };
});

interface HealthBody {
  status: "ok" | "degraded";
  timestamp: string;
  version: string;
  services: {
    database: "ok" | "error";
    redis: "ok" | "error";
  };
}

describe("GET /api/v1/health", () => {
  it("returns 200 with status ok when all services are healthy", async () => {
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);

    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("ok");
    expect(body.services.database).toBe("ok");
    expect(body.services.redis).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 503 when database is down", async () => {
    const { db } = await import("../lib/db.js");
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("connection refused"));

    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(503);

    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("degraded");
    expect(body.services.database).toBe("error");
  });
});
