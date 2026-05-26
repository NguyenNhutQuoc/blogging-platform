import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { app } from "../app.js";
import { createTestUser } from "./helpers.js";
import { testDb } from "./setup.js";
import { newsletterSubscribers, newsletters } from "@repo/database/schema";
import { uuidv7 } from "uuidv7";

vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  imageQueue: { add: vi.fn() },
  postScheduleQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
  newsletterQueue: { add: vi.fn().mockResolvedValue(undefined) },
  gdprQueue: { add: vi.fn() },
}));

vi.mock("../lib/auth.js", () => ({
  auth: {
    handler: vi.fn(),
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

import { auth } from "../lib/auth.js";
import { emailQueue } from "../jobs/queues.js";

const mockGetSession = vi.mocked(auth.api.getSession);

function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: { id: "s1", userId: user.id, expiresAt: new Date(Date.now() + 86400_000), token: "t", createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
  } as never);
}

function clearAuth() { mockGetSession.mockResolvedValue(null); }

// ─── Subscriber factory ───────────────────────────────────────────────────────

async function createTestSubscriber(overrides: {
  email?: string;
  status?: "active" | "unsubscribed" | "bounced" | "complained";
  confirmToken?: string | null;
} = {}) {
  const [row] = await testDb.insert(newsletterSubscribers).values({
    id: uuidv7(),
    email: overrides.email ?? `sub-${uuidv7()}@example.com`,
    status: overrides.status ?? "active",
    unsubscribeToken: uuidv7(),
    confirmToken: overrides.confirmToken !== undefined ? overrides.confirmToken : null,
  }).returning();
  return row!;
}

// ─── Newsletter factory ───────────────────────────────────────────────────────

async function createTestNewsletter(authorId: string, overrides: {
  subject?: string;
  status?: "draft" | "scheduled" | "sending" | "sent";
} = {}) {
  const [row] = await testDb.insert(newsletters).values({
    id: uuidv7(),
    subject: overrides.subject ?? "Test Newsletter",
    contentHtml: "<p>Hello world</p>",
    status: overrides.status ?? "draft",
    authorId,
  }).returning();
  return row!;
}

// ─── POST /api/v1/newsletter/subscribe ───────────────────────────────────────

describe("POST /api/v1/newsletter/subscribe", () => {
  it("creates a new subscriber and sends confirm email", async () => {
    const mockAdd = vi.mocked(emailQueue.add);
    mockAdd.mockClear();

    const res = await app.request("/api/v1/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newsubscriber@example.com", name: "Alice" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledOnce();
    expect(mockAdd.mock.calls[0]![1]).toMatchObject({ template: "newsletter-confirm" });
  });

  it("rejects invalid email", async () => {
    const res = await app.request("/api/v1/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("is idempotent for an already-active subscriber", async () => {
    await createTestSubscriber({ email: "existing@example.com", status: "active" });

    const res = await app.request("/api/v1/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "existing@example.com" }),
    });
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/v1/newsletter/confirm ──────────────────────────────────────────

describe("GET /api/v1/newsletter/confirm", () => {
  it("confirms subscription with a valid token", async () => {
    const token = uuidv7();
    const sub = await createTestSubscriber({ status: "active", confirmToken: token });

    const res = await app.request(`/api/v1/newsletter/confirm?token=${token}`);
    expect(res.status).toBe(200);

    const [updated] = await testDb.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, sub.id));
    expect(updated?.status).toBe("active");
    expect(updated?.confirmToken).toBeNull();
  });

  it("returns 404 for unknown token", async () => {
    const res = await app.request("/api/v1/newsletter/confirm?token=badtoken");
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/newsletter/unsubscribe ─────────────────────────────────────

describe("POST /api/v1/newsletter/unsubscribe", () => {
  it("unsubscribes with a valid token", async () => {
    const unsub = uuidv7();
    const sub = await createTestSubscriber({ status: "active" });
    // Update unsubscribeToken to a known value
    const [updated] = await testDb.update(newsletterSubscribers)
      .set({ unsubscribeToken: unsub })
      .where(eq(newsletterSubscribers.id, sub.id))
      .returning();

    const res = await app.request("/api/v1/newsletter/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: unsub }),
    });
    expect(res.status).toBe(200);
    expect(updated!.id).toBe(sub.id);
  });

  it("returns 404 for unknown unsubscribe token", async () => {
    const res = await app.request("/api/v1/newsletter/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "unknown-token" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── Admin: GET /api/v1/admin/newsletter/subscribers ─────────────────────────

describe("GET /api/v1/admin/newsletter/subscribers", () => {
  beforeEach(() => clearAuth());

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/newsletter/subscribers");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin role", async () => {
    const user = await createTestUser({ role: "author" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/admin/newsletter/subscribers");
    expect(res.status).toBe(403);
  });

  it("returns subscriber list for admin", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    await createTestSubscriber({ status: "active" });

    const res = await app.request("/api/v1/admin/newsletter/subscribers");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
  });
});

// ─── Admin: POST /api/v1/admin/newsletters ────────────────────────────────────

describe("POST /api/v1/admin/newsletters", () => {
  beforeEach(() => clearAuth());

  it("creates a newsletter draft", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });

    const res = await app.request("/api/v1/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Test Issue #1",
        contentHtml: "<p>Hello readers!</p>",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { subject: string; status: string } };
    expect(body.data.subject).toBe("Test Issue #1");
    expect(body.data.status).toBe("draft");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.request("/api/v1/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", contentHtml: "<p>Hi</p>" }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Admin: POST /api/v1/admin/newsletters/:id/schedule ──────────────────────

describe("POST /api/v1/admin/newsletters/:id/schedule", () => {
  beforeEach(() => clearAuth());

  it("schedules a newsletter for future delivery", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });
    const newsletter = await createTestNewsletter(admin.id);

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await app.request(`/api/v1/admin/newsletters/${newsletter.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: future }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("scheduled");
  });

  it("rejects a past scheduledAt", async () => {
    const admin = await createTestUser({ role: "admin" });
    mockAuth({ id: admin.id, role: admin.role, email: admin.email, name: admin.name });
    const newsletter = await createTestNewsletter(admin.id);

    const past = new Date(Date.now() - 1000).toISOString();
    const res = await app.request(`/api/v1/admin/newsletters/${newsletter.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: past }),
    });

    expect(res.status).toBe(400);
  });
});
