import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser, createTestPost, createTestCategory, createTestTag } from "./helpers.js";

/**
 * Posts API integration tests.
 * Require the test DB (port 5433) to be running with migrations applied.
 * Skips gracefully when DB is unavailable (mocked layer only).
 */

// Mock BullMQ queues so tests don't need a real Redis connection
vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn() },
  imageQueue: { add: vi.fn() },
  postScheduleQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
  newsletterQueue: { add: vi.fn() },
}));

// Mock Better Auth so tests control session state
vi.mock("../lib/auth.js", () => ({
  auth: {
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { auth } from "../lib/auth.js";

const mockGetSession = vi.mocked(auth.api.getSession);

/** Sets the mock session to an authenticated user for subsequent requests. */
function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: { id: "sess-1", userId: user.id, expiresAt: new Date(Date.now() + 86400_000), token: "tok", createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
  } as never);
}

function clearAuth() {
  mockGetSession.mockResolvedValue(null);
}

// ─── List posts ───────────────────────────────────────────────────────────────

describe("GET /api/v1/posts", () => {
  it("returns empty list when no posts exist", async () => {
    const res = await app.request("/api/v1/posts");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; meta: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it("returns published posts", async () => {
    const user = await createTestUser();
    await createTestPost(user.id, { status: "published", publishedAt: new Date() });
    await createTestPost(user.id, { status: "draft" });

    // By default list returns all statuses — filter by published
    const res = await app.request("/api/v1/posts?status=published");
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("paginates results", async () => {
    const user = await createTestUser();
    // Create 3 posts
    await Promise.all([
      createTestPost(user.id, { title: "Post 1", slug: "post-1" }),
      createTestPost(user.id, { title: "Post 2", slug: "post-2" }),
      createTestPost(user.id, { title: "Post 3", slug: "post-3" }),
    ]);

    const res = await app.request("/api/v1/posts?page=1&pageSize=2");
    const body = await res.json() as { data: unknown[]; meta: { total: number; totalPages: number; hasNextPage: boolean } };
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(3);
    expect(body.meta.totalPages).toBe(2);
    expect(body.meta.hasNextPage).toBe(true);
  });

  it("filters by category", async () => {
    const user = await createTestUser();
    const cat = await createTestCategory({ slug: "tech" });
    await createTestPost(user.id, { categoryIds: [cat.id], slug: "post-with-cat" });
    await createTestPost(user.id, { slug: "post-without-cat" });

    const res = await app.request(`/api/v1/posts?categoryId=${cat.id}`);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("filters by tag", async () => {
    const user = await createTestUser();
    const tag = await createTestTag({ slug: "javascript" });
    await createTestPost(user.id, { tagIds: [tag.id], slug: "tagged-post" });
    await createTestPost(user.id, { slug: "untagged-post" });

    const res = await app.request(`/api/v1/posts?tagId=${tag.id}`);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

// ─── Create post ──────────────────────────────────────────────────────────────

describe("POST /api/v1/posts", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a draft post with auto-generated slug", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello World" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { slug: string; status: string; authorId: string } };
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("hello-world");
    expect(body.data.status).toBe("draft");
    expect(body.data.authorId).toBe(user.id);
  });

  it("creates post with explicit slug", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Post", slug: "custom-slug" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { slug: string } };
    expect(body.data.slug).toBe("custom-slug");
  });

  it("returns 409 on duplicate slug", async () => {
    const user = await createTestUser({ role: "author" });
    await createTestPost(user.id, { slug: "duplicate" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Dup", slug: "duplicate" }),
    });

    expect(res.status).toBe(409);
  });

  it("attaches categories and tags", async () => {
    const user = await createTestUser({ role: "author" });
    const cat = await createTestCategory({ slug: "cat-1" });
    const tag = await createTestTag({ slug: "tag-1" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Rich Post", categoryIds: [cat.id], tagIds: [tag.id] }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { categories: { id: string }[]; tags: { id: string }[] } };
    expect(body.data.categories[0]?.id).toBe(cat.id);
    expect(body.data.tags[0]?.id).toBe(tag.id);
  });
});

// ─── Get post by slug ─────────────────────────────────────────────────────────

describe("GET /api/v1/posts/:slug", () => {
  it("returns post", async () => {
    const user = await createTestUser();
    await createTestPost(user.id, { slug: "my-post", status: "published", publishedAt: new Date() });

    const res = await app.request("/api/v1/posts/my-post");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { slug: string; author: { id: string } } };
    expect(body.data.slug).toBe("my-post");
    expect(body.data.author.id).toBe(user.id);
  });

  it("returns 404 for unknown slug", async () => {
    const res = await app.request("/api/v1/posts/does-not-exist");
    expect(res.status).toBe(404);
  });
});

// ─── Update post ──────────────────────────────────────────────────────────────

describe("PATCH /api/v1/posts/:id", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id);

    const res = await app.request(`/api/v1/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    expect(res.status).toBe(401);
  });

  it("updates own post", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { slug: "update-me" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request(`/api/v1/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { title: string } };
    expect(body.data.title).toBe("Updated Title");
  });

  it("returns 403 when updating another author's post", async () => {
    const owner = await createTestUser({ role: "author", email: "owner@test.com" });
    const other = await createTestUser({ role: "author", email: "other@test.com" });
    const post = await createTestPost(owner.id, { slug: "not-yours" });
    mockAuth({ id: other.id, role: other.role, email: other.email, name: other.name });

    const res = await app.request(`/api/v1/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hack" }),
    });
    expect(res.status).toBe(403);
  });

  it("admin can update any post", async () => {
    const owner = await createTestUser({ role: "author", email: "owner2@test.com" });
    const admin = await createTestUser({ role: "admin", email: "admin@test.com" });
    const post = await createTestPost(owner.id, { slug: "admin-editable" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Admin Edit" }),
    });
    expect(res.status).toBe(200);
  });
});

// ─── Publish / Schedule ───────────────────────────────────────────────────────

describe("POST /api/v1/posts/:id/publish", () => {
  beforeEach(() => clearAuth());

  it("publishes a draft post", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { status: "draft", slug: "publish-me" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request(`/api/v1/posts/${post.id}/publish`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string; publishedAt: string } };
    expect(body.data.status).toBe("published");
    expect(body.data.publishedAt).not.toBeNull();
  });

  it("returns 409 when already published", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, {
      status: "published",
      publishedAt: new Date(),
      slug: "already-pub",
    });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request(`/api/v1/posts/${post.id}/publish`, { method: "POST" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/posts/:id/schedule", () => {
  beforeEach(() => clearAuth());

  it("schedules a post for future publication", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { slug: "sched-me" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await app.request(`/api/v1/posts/${post.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: future }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string; scheduledAt: string } };
    expect(body.data.status).toBe("scheduled");
    expect(body.data.scheduledAt).not.toBeNull();
  });

  it("rejects past scheduledAt", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { slug: "past-sched" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await app.request(`/api/v1/posts/${post.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: past }),
    });

    expect(res.status).toBe(422);
  });
});

// ─── Delete post ──────────────────────────────────────────────────────────────

describe("DELETE /api/v1/posts/:id", () => {
  beforeEach(() => clearAuth());

  it("soft-deletes own post", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { slug: "delete-me" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request(`/api/v1/posts/${post.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    // Confirm it's no longer reachable
    const getRes = await app.request(`/api/v1/posts/delete-me`);
    expect(getRes.status).toBe(404);
  });

  it("returns 403 when deleting another author's post", async () => {
    const owner = await createTestUser({ role: "author", email: "del-owner@test.com" });
    const other = await createTestUser({ role: "author", email: "del-other@test.com" });
    const post = await createTestPost(owner.id, { slug: "not-yours-del" });
    mockAuth({ id: other.id, role: other.role, email: other.email, name: other.name });

    const res = await app.request(`/api/v1/posts/${post.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
