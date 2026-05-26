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
  gdprQueue: { add: vi.fn().mockResolvedValue(undefined) },
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

// ─── GET /admin/users ─────────────────────────────────────────────────────────

describe("GET /api/v1/admin/users", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin role", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/admin/users");
    expect(res.status).toBe(403);
  });

  it("returns user list for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/users");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe("number");
  });

  it("filters by role", async () => {
    const admin = await createTestUser({ role: "admin" });
    await createTestUser({ role: "author" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/users?role=author");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { role: string }[] };
    expect(body.data.every((u) => u.role === "author")).toBe(true);
  });
});

// ─── PATCH /admin/users/:id/role ──────────────────────────────────────────────

describe("PATCH /api/v1/admin/users/:id/role", () => {
  beforeEach(() => clearAuth());

  it("changes a user role", async () => {
    const admin = await createTestUser({ role: "admin" });
    const target = await createTestUser({ role: "subscriber" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/admin/users/${target.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "author" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { role: string } };
    expect(body.data.role).toBe("author");
  });

  it("returns 404 for unknown user", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/users/nonexistent-id/role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "author" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /admin/users/:id/status ────────────────────────────────────────────

describe("PATCH /api/v1/admin/users/:id/status", () => {
  beforeEach(() => clearAuth());

  it("suspends a user", async () => {
    const admin = await createTestUser({ role: "admin" });
    const target = await createTestUser({ role: "author" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/admin/users/${target.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("suspended");
  });
});

// ─── GET /admin/audit-logs ────────────────────────────────────────────────────

describe("GET /api/v1/admin/audit-logs", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/audit-logs");
    expect(res.status).toBe(401);
  });

  it("returns audit logs for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/audit-logs");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── GET /admin/settings ──────────────────────────────────────────────────────

describe("GET /api/v1/admin/settings", () => {
  beforeEach(() => clearAuth());

  it("returns settings for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/settings");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Record<string, unknown> };
    expect(typeof body.data).toBe("object");
  });
});

// ─── PUT /admin/settings ──────────────────────────────────────────────────────

describe("PUT /api/v1/admin/settings", () => {
  beforeEach(() => clearAuth());

  it("upserts settings", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_name: "My Blog", allow_comments: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Record<string, unknown> };
    expect(body.data.site_name).toBe("My Blog");
  });
});

// ─── Pages ────────────────────────────────────────────────────────────────────

describe("Pages API", () => {
  beforeEach(() => clearAuth());

  it("creates and retrieves a page", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const createRes = await app.request("/api/v1/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Privacy Policy", slug: "privacy-policy", content: "<p>Content</p>", status: "published" }),
    });
    expect(createRes.status).toBe(201);

    clearAuth();
    const getRes = await app.request("/api/v1/pages/privacy-policy");
    expect(getRes.status).toBe(200);
    const body = await getRes.json() as { data: { title: string; slug: string } };
    expect(body.data.slug).toBe("privacy-policy");
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.request("/api/v1/pages/does-not-exist");
    expect(res.status).toBe(404);
  });
});
