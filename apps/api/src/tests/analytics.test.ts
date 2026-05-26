import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser, createTestPost } from "./helpers.js";

vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn() },
  imageQueue: { add: vi.fn() },
  postScheduleQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
  newsletterQueue: { add: vi.fn() },
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
    // ioredis pipeline results: [[err, result], ...]  index 2 = zcount result
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
  };
  return {
    redis: {
      zadd: vi.fn().mockResolvedValue(1),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      expire: vi.fn().mockResolvedValue(1),
      zcount: vi.fn().mockResolvedValue(3),
      // Rate-limit middleware uses pipeline() on every request
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

// ─── POST /api/v1/analytics/pageview ─────────────────────────────────────────

describe("POST /api/v1/analytics/pageview", () => {
  it("tracks a page view and returns 200", async () => {
    const res = await app.request("/api/v1/analytics/pageview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBrowser/1.0",
      },
      body: JSON.stringify({
        path: "/blog/my-post",
        sessionId: "session-abc123",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("tracks a page view with postId", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, {
      status: "published",
      publishedAt: new Date(),
      slug: "analytics-test-post",
    });

    const res = await app.request("/api/v1/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/blog/${post.slug}`,
        postId: post.id,
        sessionId: "session-xyz",
        referrer: "https://twitter.com",
        utmSource: "twitter",
        utmMedium: "social",
      }),
    });

    expect(res.status).toBe(200);
  });

  it("rejects missing required fields", async () => {
    const res = await app.request("/api/v1/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/test" }), // missing sessionId
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/analytics/reaction ─────────────────────────────────────────

describe("POST /api/v1/analytics/reaction", () => {
  it("tracks a reaction and returns 200", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, { status: "published", publishedAt: new Date(), slug: "reaction-test" });

    const res = await app.request("/api/v1/analytics/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: post.id,
        reactionType: "like",
        sessionId: "sess-1",
      }),
    });

    expect(res.status).toBe(200);
  });

  it("rejects invalid reactionType", async () => {
    const res = await app.request("/api/v1/analytics/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "some-id", reactionType: "dislike", sessionId: "sess" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/analytics/posts/:postId/reactions ───────────────────────────

describe("GET /api/v1/analytics/posts/:postId/reactions", () => {
  it("returns reaction counts for a post", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, { status: "published", publishedAt: new Date(), slug: "rxn-count-test" });

    // Track a couple of reactions first
    await app.request("/api/v1/analytics/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, reactionType: "like", sessionId: "s1" }),
    });

    const res = await app.request(`/api/v1/analytics/posts/${post.id}/reactions`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Record<string, number> };
    expect(typeof body.data).toBe("object");
  });
});

// ─── POST /api/v1/analytics/reading-progress ─────────────────────────────────

describe("POST /api/v1/analytics/reading-progress", () => {
  it("tracks reading progress and returns 200", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, { status: "published", publishedAt: new Date(), slug: "progress-test" });

    const res = await app.request("/api/v1/analytics/reading-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: post.id,
        sessionId: "sess-read",
        scrollDepthPercent: 75,
        timeSpentSeconds: 120,
        finishedReading: false,
      }),
    });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/v1/admin/analytics/overview ────────────────────────────────────

describe("GET /api/v1/admin/analytics/overview", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/analytics/overview");
    expect(res.status).toBe(401);
  });

  it("returns 403 for subscriber role", async () => {
    const user = await createTestUser({ role: "subscriber" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/admin/analytics/overview");
    expect(res.status).toBe(403);
  });

  it("returns overview stats for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/analytics/overview");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        totalViews: number;
        uniqueVisitors: number;
        realtimeVisitors: number;
        topPosts: unknown[];
        topReferrers: unknown[];
        viewsByDay: unknown[];
      };
    };
    expect(typeof body.data.totalViews).toBe("number");
    expect(typeof body.data.uniqueVisitors).toBe("number");
    expect(typeof body.data.realtimeVisitors).toBe("number");
    expect(Array.isArray(body.data.topPosts)).toBe(true);
  });
});

// ─── GET /api/v1/admin/analytics/realtime ────────────────────────────────────

describe("GET /api/v1/admin/analytics/realtime", () => {
  beforeEach(() => clearAuth());

  it("returns realtime visitor count for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/analytics/realtime");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { visitors: number } };
    expect(typeof body.data.visitors).toBe("number");
  });
});

// ─── GET /api/v1/admin/analytics/posts/:postId ───────────────────────────────

describe("GET /api/v1/admin/analytics/posts/:postId", () => {
  beforeEach(() => clearAuth());

  it("returns per-post analytics for author", async () => {
    const author = await createTestUser({ role: "author" });
    mockAuth({ id: author.id, role: author.role, email: author.email, name: author.name });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "post-analytics" });

    const res = await app.request(`/api/v1/admin/analytics/posts/${post.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: {
        totalViews: number;
        uniqueVisitors: number;
        avgScrollDepth: number;
        reactions: Record<string, number>;
      };
    };
    expect(typeof body.data.totalViews).toBe("number");
    expect(typeof body.data.avgScrollDepth).toBe("number");
  });
});
