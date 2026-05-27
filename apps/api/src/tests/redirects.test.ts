import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser } from "./helpers.js";

vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn() },
  imageQueue: { add: vi.fn() },
  postScheduleQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
  newsletterQueue: { add: vi.fn() },
  gdprQueue: { add: vi.fn() },
}));

vi.mock("../lib/auth.js", () => ({
  auth: {
    handler: vi.fn(),
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
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
      zadd: vi.fn().mockResolvedValue(1),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      expire: vi.fn().mockResolvedValue(1),
      zcount: vi.fn().mockResolvedValue(3),
      pipeline: vi.fn().mockReturnValue(pipelineMock),
    },
  };
});

import { auth } from "../lib/auth.js";

const mockGetSession = vi.mocked(auth.api.getSession);

function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: { id: "s1", userId: user.id, expiresAt: new Date(Date.now() + 86400_000), token: "t", createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
  } as never);
}

function clearAuth() { mockGetSession.mockResolvedValue(null); }

// ─── GET /admin/redirects ─────────────────────────────────────────────────────

describe("GET /api/v1/admin/redirects", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/redirects");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/admin/redirects");
    expect(res.status).toBe(403);
  });

  it("returns empty list when no redirects exist", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/redirects");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /admin/redirects ────────────────────────────────────────────────────

describe("POST /api/v1/admin/redirects", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath: "/old", toPath: "/new", statusCode: 301 }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a redirect", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath: "/old-page", toPath: "/new-page", statusCode: 301, isActive: true }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { fromPath: string; toPath: string; statusCode: number } };
    expect(body.data.fromPath).toBe("/old-page");
    expect(body.data.toPath).toBe("/new-page");
    expect(body.data.statusCode).toBe(301);
  });

  it("returns 409 when fromPath already exists", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const payload = { fromPath: "/dup-path", toPath: "/target", statusCode: 301, isActive: true };
    await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(409);
  });
});

// ─── PATCH /admin/redirects/:id ───────────────────────────────────────────────

describe("PATCH /api/v1/admin/redirects/:id", () => {
  beforeEach(() => clearAuth());

  it("updates a redirect", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const createRes = await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath: "/update-me", toPath: "/v1", statusCode: 301, isActive: true }),
    });
    const created = await createRes.json() as { data: { id: string } };

    const res = await app.request(`/api/v1/admin/redirects/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toPath: "/v2", isActive: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { toPath: string; isActive: boolean } };
    expect(body.data.toPath).toBe("/v2");
    expect(body.data.isActive).toBe(false);
  });

  it("returns 404 for unknown id", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/redirects/nonexistent-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toPath: "/somewhere" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /admin/redirects/:id ──────────────────────────────────────────────

describe("DELETE /api/v1/admin/redirects/:id", () => {
  beforeEach(() => clearAuth());

  it("deletes a redirect", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const createRes = await app.request("/api/v1/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath: "/delete-me", toPath: "/gone", statusCode: 302, isActive: true }),
    });
    const created = await createRes.json() as { data: { id: string } };

    const res = await app.request(`/api/v1/admin/redirects/${created.data.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown id", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/redirects/nonexistent-id", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
