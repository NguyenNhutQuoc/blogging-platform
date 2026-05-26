import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser } from "./helpers.js";

const mockGdprAdd = vi.fn().mockResolvedValue(undefined);

vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn() },
  imageQueue: { add: vi.fn() },
  postScheduleQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
  newsletterQueue: { add: vi.fn() },
  gdprQueue: { add: mockGdprAdd },
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

// ─── GET /users/me/data-export ────────────────────────────────────────────────

describe("GET /api/v1/users/me/data-export", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/users/me/data-export");
    expect(res.status).toBe(401);
  });

  it("returns full data export for authenticated user", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/users/me/data-export");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        exportedAt: string;
        user: { id: string; email: string };
        posts: unknown[];
        comments: unknown[];
      };
    };
    expect(body.data.user.id).toBe(user.id);
    expect(body.data.user.email).toBe(user.email);
    expect(Array.isArray(body.data.posts)).toBe(true);
    expect(Array.isArray(body.data.comments)).toBe(true);
    expect(typeof body.data.exportedAt).toBe("string");
  });
});

// ─── DELETE /users/me ─────────────────────────────────────────────────────────

describe("DELETE /api/v1/users/me", () => {
  beforeEach(() => {
    clearAuth();
    mockGdprAdd.mockClear();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/users/me", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("schedules account deletion and enqueues hard-delete job", async () => {
    const user = await createTestUser({ role: "subscriber" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/users/me", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toContain("30 days");
    expect(mockGdprAdd).toHaveBeenCalledOnce();
    expect(mockGdprAdd.mock.calls[0]![1]).toMatchObject({ type: "hard-delete", userId: user.id });
  });
});
