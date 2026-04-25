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

import { auth } from "../lib/auth.js";

const mockGetSession = vi.mocked(auth.api.getSession);

function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: { id: "s1", userId: user.id, expiresAt: new Date(Date.now() + 86400_000), token: "t", createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
  } as never);
}

function clearAuth() { mockGetSession.mockResolvedValue(null); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function postComment(postId: string, content: string, parentId?: string) {
  return app.request(`/api/v1/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(parentId && { parentId }) }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/v1/posts/:postId/comments", () => {
  it("returns empty list for a post with no comments", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, {
      status: "published",
      publishedAt: new Date(),
      slug: "comment-test-1",
    });

    const res = await app.request(`/api/v1/posts/${post.id}/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

describe("POST /api/v1/posts/:postId/comments", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const user = await createTestUser();
    const post = await createTestPost(user.id, { status: "published", publishedAt: new Date(), slug: "comment-test-2" });

    const res = await postComment(post.id, "Nice post!");
    expect(res.status).toBe(401);
  });

  it("creates comment on a published post", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "comment-test-3" });

    const commenter = await createTestUser({ role: "subscriber", email: "commenter@test.com" });
    mockAuth({ id: commenter.id, role: commenter.role, email: commenter.email, name: commenter.name });

    const res = await postComment(post.id, "Great article!");
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { content: string; status: string } };
    expect(body.data.content).toBe("Great article!");
    // subscribers go to pending
    expect(body.data.status).toBe("pending");
  });

  it("auto-approves comment from admin", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "comment-test-4" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await postComment(post.id, "Admin comment");
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("approved");
  });

  it("rejects comment on unpublished post", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, { status: "draft", slug: "draft-post-comment" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await postComment(post.id, "Can't comment on draft");
    expect(res.status).toBe(403);
  });

  it("creates a reply to an existing comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "reply-test" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    // Parent comment
    const parentRes = await postComment(post.id, "Parent comment");
    const parentBody = await parentRes.json() as { data: { id: string } };
    const parentId = parentBody.data.id;

    // Reply
    const replyRes = await postComment(post.id, "Reply comment", parentId);
    expect(replyRes.status).toBe(201);
    const replyBody = await replyRes.json() as { data: { parentId: string } };
    expect(replyBody.data.parentId).toBe(parentId);
  });
});

describe("PATCH /api/v1/comments/:id", () => {
  beforeEach(() => clearAuth());

  it("allows author to edit their own comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "edit-comment-post" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "Original content");
    const commentId = (await commentRes.json() as { data: { id: string } }).data.id;

    const res = await app.request(`/api/v1/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Edited content" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { content: string } };
    expect(body.data.content).toBe("Edited content");
  });

  it("returns 403 when editing another user's comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "edit-forbidden-post" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "Admin's comment");
    const commentId = (await commentRes.json() as { data: { id: string } }).data.id;

    const other = await createTestUser({ role: "subscriber", email: "other2@test.com" });
    mockAuth({ id: other.id, role: other.role, email: other.email, name: other.name });

    const res = await app.request(`/api/v1/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hijacked" }),
    });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/comments/:id/moderate", () => {
  beforeEach(() => clearAuth());

  it("admin can approve a pending comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "moderate-post" });

    const subscriber = await createTestUser({ role: "subscriber", email: "sub2@test.com" });
    mockAuth({ id: subscriber.id, role: subscriber.role, email: subscriber.email, name: subscriber.name });

    const commentRes = await postComment(post.id, "Pending comment");
    const commentId = (await commentRes.json() as { data: { id: string; status: string } }).data.id;

    const admin = await createTestUser({ role: "admin", email: "admin2@test.com" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request(`/api/v1/comments/${commentId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("approved");
  });

  it("admin can mark a comment as spam", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "spam-post" });

    const admin = await createTestUser({ role: "admin", email: "admin3@test.com" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "Spam content");
    const commentId = (await commentRes.json() as { data: { id: string } }).data.id;

    const res = await app.request(`/api/v1/comments/${commentId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "spam" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("spam");
  });

  it("returns 403 when subscriber tries to moderate", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "moderate-forbidden-post" });

    const admin = await createTestUser({ role: "admin", email: "admin4@test.com" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "Some comment");
    const commentId = (await commentRes.json() as { data: { id: string } }).data.id;

    const subscriber = await createTestUser({ role: "subscriber", email: "sub3@test.com" });
    mockAuth({ id: subscriber.id, role: subscriber.role, email: subscriber.email, name: subscriber.name });

    const res = await app.request(`/api/v1/comments/${commentId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/comments/:id", () => {
  beforeEach(() => clearAuth());

  it("deletes own comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "delete-comment-test" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "To be deleted");
    const commentBody = await commentRes.json() as { data: { id: string } };
    const commentId = commentBody.data.id;

    const delRes = await app.request(`/api/v1/comments/${commentId}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
  });

  it("returns 403 when trying to delete another user's comment", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, { status: "published", publishedAt: new Date(), slug: "forbidden-delete-comment" });

    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const commentRes = await postComment(post.id, "Admin's comment");
    const commentBody = await commentRes.json() as { data: { id: string } };
    const commentId = commentBody.data.id;

    // Switch to a different subscriber
    const subscriber = await createTestUser({ role: "subscriber", email: "sub@test.com" });
    mockAuth({ id: subscriber.id, role: subscriber.role, email: subscriber.email, name: subscriber.name });

    const delRes = await app.request(`/api/v1/comments/${commentId}`, { method: "DELETE" });
    expect(delRes.status).toBe(403);
  });
});
