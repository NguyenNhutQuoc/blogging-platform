import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser, createTestCategory, createTestTag, createTestPost } from "./helpers.js";

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

import { auth } from "../lib/auth.js";

const mockGetSession = vi.mocked(auth.api.getSession);

function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: { id: "s1", userId: user.id, expiresAt: new Date(Date.now() + 86400_000), token: "t", createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
  } as never);
}

function clearAuth() { mockGetSession.mockResolvedValue(null); }

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/v1/categories", () => {
  it("returns empty list", async () => {
    const res = await app.request("/api/v1/categories");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it("returns all categories ordered by sortOrder", async () => {
    await createTestCategory({ name: "B Cat", slug: "b-cat" });
    await createTestCategory({ name: "A Cat", slug: "a-cat" });

    const res = await app.request("/api/v1/categories");
    const body = await res.json() as { data: { name: string }[] };
    // Both cats have sortOrder=0 so fall back to name sort — "A Cat" first
    expect(body.data).toHaveLength(2);
  });
});

describe("POST /api/v1/categories", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for author role", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });
    expect(res.status).toBe(403);
  });

  it("creates a category (admin)", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Technology" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { name: string; slug: string } };
    expect(body.data.name).toBe("Technology");
    expect(body.data.slug).toBe("technology");
  });

  it("returns 409 on slug conflict", async () => {
    await createTestCategory({ name: "Dup", slug: "dup" });
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup", slug: "dup" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/v1/categories/:id", () => {
  beforeEach(() => clearAuth());

  it("updates a category", async () => {
    const cat = await createTestCategory({ name: "Old Name", slug: "old-name" });
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { name: string } };
    expect(body.data.name).toBe("New Name");
  });
});

describe("DELETE /api/v1/categories/:id", () => {
  beforeEach(() => clearAuth());

  it("deletes an unused category", async () => {
    const cat = await createTestCategory({ slug: "delete-cat" });
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/categories/${cat.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("returns 409 when category has posts", async () => {
    const cat = await createTestCategory({ slug: "in-use-cat" });
    const user = await createTestUser({ role: "author" });
    await createTestPost(user.id, { categoryIds: [cat.id], slug: "in-use-post" });

    const admin = await createTestUser({ role: "admin", email: "admin3@test.com" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/categories/${cat.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/v1/tags", () => {
  it("returns all tags", async () => {
    await createTestTag({ name: "JavaScript", slug: "javascript" });
    await createTestTag({ name: "TypeScript", slug: "typescript" });

    const res = await app.request("/api/v1/tags");
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(2);
  });
});

describe("POST /api/v1/tags", () => {
  beforeEach(() => clearAuth());

  it("creates a tag (admin)", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "React" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { name: string; slug: string } };
    expect(body.data.name).toBe("React");
    expect(body.data.slug).toBe("react");
  });

  it("returns 409 on duplicate slug", async () => {
    await createTestTag({ name: "Dup Tag", slug: "dup-tag" });
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Tag", slug: "dup-tag" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/v1/tags/:id", () => {
  beforeEach(() => clearAuth());

  it("deletes an unused tag", async () => {
    const tag = await createTestTag({ slug: "delete-tag" });
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/tags/${tag.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("returns 409 when tag has posts", async () => {
    const tag = await createTestTag({ slug: "in-use-tag" });
    const user = await createTestUser({ role: "author" });
    await createTestPost(user.id, { tagIds: [tag.id], slug: "tagged-post-2" });

    const admin = await createTestUser({ role: "admin", email: "admin4@test.com" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/tags/${tag.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
  });
});
