import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser, createTestPost } from "./helpers.js";
import { testDb } from "./setup.js";
import { subscriptionPlans, subscriptions, coupons } from "@repo/database/schema";
import { uuidv7 } from "uuidv7";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("../lib/stripe.js", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" }),
      },
    },
    subscriptions: {
      cancel: vi.fn().mockResolvedValue({}),
      retrieve: vi.fn().mockResolvedValue({
        id: "sub_test",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        trial_end: null,
      }),
    },
    customers: {
      retrieve: vi.fn().mockResolvedValue({
        id: "cus_test",
        email: "user@example.com",
        name: "Test User",
        deleted: false,
      }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

import { auth } from "../lib/auth.js";
import { stripe } from "../lib/stripe.js";
import { emailQueue } from "../jobs/queues.js";

const mockGetSession = vi.mocked(auth.api.getSession);
// Use type assertion for nested Stripe mocks since vi.mocked doesn't deeply infer mock types
const mockConstructEvent = stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>;
const mockRetrieveSub = stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>;
const mockEmailQueue = vi.mocked(emailQueue);

function mockAuth(user: { id: string; role: string; email: string; name: string }) {
  mockGetSession.mockResolvedValue({
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
    session: {
      id: "sess-1",
      userId: user.id,
      expiresAt: new Date(Date.now() + 86400_000),
      token: "tok",
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as never);
}

function clearAuth() {
  mockGetSession.mockResolvedValue(null);
}

// ─── Test data helpers ────────────────────────────────────────────────────────

async function createTestPlan(overrides: Partial<{
  name: string;
  slug: string;
  priceMonthyCents: number;
  priceYearlyCents: number;
  stripePriceIdMonthly: string;
  isActive: boolean;
}> = {}) {
  const id = uuidv7();
  const [plan] = await testDb
    .insert(subscriptionPlans)
    .values({
      id,
      name: overrides.name ?? "Pro",
      slug: overrides.slug ?? `pro-${id.slice(0, 8)}`,
      priceMonthyCents: overrides.priceMonthyCents ?? 900,
      priceYearlyCents: overrides.priceYearlyCents ?? 8900,
      stripePriceIdMonthly: overrides.stripePriceIdMonthly ?? "price_monthly_test",
      stripePriceIdYearly: "price_yearly_test",
      isActive: overrides.isActive ?? true,
      sortOrder: 1,
    })
    .returning();
  return plan!;
}

async function createTestSubscription(userId: string, planId: string, status = "active") {
  const [sub] = await testDb
    .insert(subscriptions)
    .values({
      id: uuidv7(),
      userId,
      planId,
      stripeSubscriptionId: `sub_${uuidv7().slice(0, 8)}`,
      stripeCustomerId: "cus_test",
      status: status as "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
    })
    .returning();
  return sub!;
}

async function createTestCoupon(overrides: Partial<{
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}> = {}) {
  const code = overrides.code ?? `TEST${uuidv7().slice(0, 6).toUpperCase()}`;
  const [coupon] = await testDb
    .insert(coupons)
    .values({
      id: uuidv7(),
      code,
      discountType: overrides.discountType ?? "percentage",
      discountValue: overrides.discountValue ?? 20,
      maxUses: overrides.maxUses !== undefined ? overrides.maxUses : null,
      currentUses: overrides.currentUses ?? 0,
      validFrom: overrides.validFrom !== undefined ? overrides.validFrom : null,
      validUntil: overrides.validUntil !== undefined ? overrides.validUntil : null,
      isActive: overrides.isActive ?? true,
    })
    .returning();
  return coupon!;
}

// ─── GET /subscriptions/plans ─────────────────────────────────────────────────

describe("GET /api/v1/subscriptions/plans", () => {
  it("returns empty list when no plans", async () => {
    const res = await app.request("/api/v1/subscriptions/plans");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it("returns active plans only", async () => {
    await createTestPlan({ name: "Pro", slug: "pro", isActive: true });
    await createTestPlan({ name: "Hidden", slug: "hidden", isActive: false });

    const res = await app.request("/api/v1/subscriptions/plans");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { slug: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.slug).toBe("pro");
  });
});

// ─── GET /subscriptions/me ────────────────────────────────────────────────────

describe("GET /api/v1/subscriptions/me", () => {
  it("returns 401 when unauthenticated", async () => {
    clearAuth();
    const res = await app.request("/api/v1/subscriptions/me");
    expect(res.status).toBe(401);
  });

  it("returns null when user has no subscription", async () => {
    const user = await createTestUser({ role: "subscriber" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/me");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: null };
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it("returns subscription and plan for active subscriber", async () => {
    const user = await createTestUser({ role: "subscriber" });
    const plan = await createTestPlan({ name: "Pro", slug: "pro-active" });
    await createTestSubscription(user.id, plan.id, "active");

    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/me");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { subscription: { status: string }; plan: { name: string } } };
    expect(body.data.subscription.status).toBe("active");
    expect(body.data.plan.name).toBe("Pro");
  });
});

// ─── POST /subscriptions/checkout ─────────────────────────────────────────────

describe("POST /api/v1/subscriptions/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    clearAuth();
    const res = await app.request("/api/v1/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "some-id", interval: "monthly" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown planId", async () => {
    const user = await createTestUser();
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: uuidv7(), interval: "monthly" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns checkout URL for valid plan", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-checkout" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval: "monthly" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { url: string } };
    expect(body.success).toBe(true);
    expect(body.data.url).toBe("https://checkout.stripe.com/test");
  });

  it("returns 409 if user already has active subscription", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-dup" });
    await createTestSubscription(user.id, plan.id, "active");
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval: "monthly" }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 422 for invalid/expired coupon", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-coupon" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval: "monthly", couponCode: "INVALID" }),
    });
    expect(res.status).toBe(422);
  });
});

// ─── POST /subscriptions/validate-coupon ─────────────────────────────────────

describe("POST /api/v1/subscriptions/validate-coupon", () => {
  it("returns valid=false for unknown code", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-vc" });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "DOESNOTEXIST", planId: plan.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { valid: boolean } };
    expect(body.data.valid).toBe(false);
  });

  it("returns valid=false for expired coupon", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-expired" });
    await createTestCoupon({
      code: "EXPIRED10",
      validUntil: new Date(Date.now() - 86400_000), // yesterday
    });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "EXPIRED10", planId: plan.id }),
    });
    const body = await res.json() as { data: { valid: boolean } };
    expect(body.data.valid).toBe(false);
  });

  it("returns valid=true with discount description for valid coupon", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-valid-coupon" });
    await createTestCoupon({ code: "SAVE20", discountType: "percentage", discountValue: 20 });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SAVE20", planId: plan.id }),
    });
    const body = await res.json() as { data: { valid: boolean; discountDescription: string } };
    expect(body.data.valid).toBe(true);
    expect(body.data.discountDescription).toBe("20% off");
  });

  it("returns valid=false when coupon has exhausted max uses", async () => {
    const user = await createTestUser();
    const plan = await createTestPlan({ slug: "pro-maxuses" });
    await createTestCoupon({ code: "MAXUSED", maxUses: 5, currentUses: 5 });
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "MAXUSED", planId: plan.id }),
    });
    const body = await res.json() as { data: { valid: boolean } };
    expect(body.data.valid).toBe(false);
  });
});

// ─── Content gating ───────────────────────────────────────────────────────────

describe("GET /api/v1/posts/:slug — content gating", () => {
  it("returns 402 for pro post when user has no subscription", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, {
      status: "published",
      visibility: "pro",
      publishedAt: new Date(),
    });

    // Authenticate as a different user with no subscription
    const reader = await createTestUser({ role: "subscriber" });
    mockAuth({ id: reader.id, role: reader.role, email: reader.email, name: reader.name });

    const res = await app.request(`/api/v1/posts/${post.slug}`);
    expect(res.status).toBe(402);
  });

  it("returns 402 for pro post when unauthenticated", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, {
      status: "published",
      visibility: "pro",
      publishedAt: new Date(),
    });
    clearAuth();

    const res = await app.request(`/api/v1/posts/${post.slug}`);
    expect(res.status).toBe(402);
  });

  it("returns 200 for pro post when user has pro subscription", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, {
      status: "published",
      visibility: "pro",
      publishedAt: new Date(),
    });

    const plan = await createTestPlan({ slug: "pro-gating" });
    const reader = await createTestUser({ role: "subscriber" });
    await createTestSubscription(reader.id, plan.id, "active");
    mockAuth({ id: reader.id, role: reader.role, email: reader.email, name: reader.name });

    const res = await app.request(`/api/v1/posts/${post.slug}`);
    expect(res.status).toBe(200);
  });

  it("returns 200 for free post without authentication", async () => {
    const user = await createTestUser({ role: "author" });
    const post = await createTestPost(user.id, {
      status: "published",
      visibility: "free",
      publishedAt: new Date(),
    });
    clearAuth();

    const res = await app.request(`/api/v1/posts/${post.slug}`);
    expect(res.status).toBe(200);
  });

  it("returns 402 for premium post when user only has pro subscription", async () => {
    const author = await createTestUser({ role: "author" });
    const post = await createTestPost(author.id, {
      status: "published",
      visibility: "premium",
      publishedAt: new Date(),
    });

    const plan = await createTestPlan({ slug: "pro-not-premium" });
    const reader = await createTestUser({ role: "subscriber" });
    await createTestSubscription(reader.id, plan.id, "active");
    mockAuth({ id: reader.id, role: reader.role, email: reader.email, name: reader.name });

    const res = await app.request(`/api/v1/posts/${post.slug}`);
    expect(res.status).toBe(402);
  });
});

// ─── Stripe webhook ───────────────────────────────────────────────────────────

describe("POST /api/v1/webhooks/stripe", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await app.request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const res = await app.request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid-sig",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("processes checkout.session.completed and enqueues welcome email", async () => {
    const user = await createTestUser({ role: "subscriber" });
    const plan = await createTestPlan({ slug: "pro-webhook" });

    const mockEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: user.id, planId: plan.id },
          subscription: "sub_webhook_test",
          customer: "cus_webhook_test",
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);
    mockRetrieveSub.mockResolvedValueOnce({
      id: "sub_webhook_test",
      status: "active",
      billing_cycle_anchor: Math.floor(Date.now() / 1000),
      trial_end: null,
    });

    const res = await app.request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid-sig",
      },
      body: JSON.stringify(mockEvent),
    });

    expect(res.status).toBe(200);
    expect(mockEmailQueue.add).toHaveBeenCalledWith(
      "subscription-activated",
      expect.objectContaining({ template: "subscription-activated" })
    );
  });

  it("processes invoice.payment_failed and enqueues payment-failed email", async () => {
    const user = await createTestUser({ role: "subscriber" });
    const plan = await createTestPlan({ slug: "pro-payment-failed" });
    const sub = await createTestSubscription(user.id, plan.id);

    const mockEvent = {
      type: "invoice.payment_failed",
      data: {
        object: {
          // Stripe v22: subscription reference moved to parent.subscription_details
          parent: {
            subscription_details: { subscription: sub.stripeSubscriptionId },
          },
          id: "inv_test",
          amount_due: 900,
          period_start: Math.floor(Date.now() / 1000) - 30 * 86400,
          period_end: Math.floor(Date.now() / 1000),
          currency: "usd",
          description: null,
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);

    const res = await app.request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid-sig",
      },
      body: JSON.stringify(mockEvent),
    });

    expect(res.status).toBe(200);
    expect(mockEmailQueue.add).toHaveBeenCalledWith(
      "payment-failed",
      expect.objectContaining({ template: "payment-failed" })
    );
  });
});

// ─── GET /subscriptions/me/payments ──────────────────────────────────────────

describe("GET /api/v1/subscriptions/me/payments", () => {
  it("returns 401 when unauthenticated", async () => {
    clearAuth();
    const res = await app.request("/api/v1/subscriptions/me/payments");
    expect(res.status).toBe(401);
  });

  it("returns empty list when user has no payments", async () => {
    const user = await createTestUser();
    mockAuth({ id: user.id, role: user.role, email: user.email, name: user.name });

    const res = await app.request("/api/v1/subscriptions/me/payments");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; meta: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });
});
