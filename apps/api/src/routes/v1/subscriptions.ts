import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import * as subsService from "../../services/subscriptions.js";
import {
  createCheckoutSchema,
  createPortalSchema,
  applyCouponSchema,
  listPaymentsSchema,
  createCouponSchema,
  updateCouponSchema,
} from "@repo/validators/subscription";

// ─── Context ──────────────────────────────────────────────────────────────────

type AuthUser = { id: string; role: string; email: string; name: string };
type Env = { Variables: { user: AuthUser; session: Record<string, unknown> } };

const router = new OpenAPIHono<Env>();

// ─── Shared schemas ───────────────────────────────────────────────────────────

const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  priceMonthyCents: z.number(),
  priceYearlyCents: z.number(),
  features: z.unknown().nullable(),
  limits: z.unknown().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const subscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string(),
  status: z.enum(["active", "past_due", "canceled", "trialing", "paused"]),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAt: z.string().nullable(),
  canceledAt: z.string().nullable(),
  trialEnd: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paymentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subscriptionId: z.string().nullable(),
  amountCents: z.number(),
  currency: z.string(),
  status: z.enum(["succeeded", "failed", "refunded"]),
  description: z.string().nullable(),
  createdAt: z.string(),
});

const couponSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number(),
  maxUses: z.number().nullable(),
  currentUses: z.number(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

// ─── GET /subscriptions/plans ─────────────────────────────────────────────────

const listPlansRoute = createRoute({
  method: "get",
  path: "/subscriptions/plans",
  tags: ["Subscriptions"],
  summary: "List subscription plans",
  description: "Returns all active subscription plans. Public endpoint.",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(planSchema) }),
        },
      },
      description: "List of plans",
    },
  },
});

router.openapi(listPlansRoute, async (c) => {
  const plans = await subsService.listPlans();
  return c.json({
    success: true as const,
    data: plans.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
});

// ─── GET /subscriptions/me ────────────────────────────────────────────────────

const getMySubscriptionRoute = createRoute({
  method: "get",
  path: "/subscriptions/me",
  tags: ["Subscriptions"],
  summary: "Get current subscription",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z
              .object({ subscription: subscriptionSchema, plan: planSchema })
              .nullable(),
          }),
        },
      },
      description: "Current subscription or null",
    },
  },
});

router.openapi(getMySubscriptionRoute, async (c) => {
  const user = c.get("user");
  const result = await subsService.getMySubscription(user.id);

  if (!result) {
    return c.json({ success: true as const, data: null });
  }

  return c.json({
    success: true as const,
    data: {
      subscription: serializeSubscription(result.subscription),
      plan: {
        ...result.plan,
        createdAt: result.plan.createdAt.toISOString(),
        updatedAt: result.plan.updatedAt.toISOString(),
      },
    },
  });
});

// ─── POST /subscriptions/checkout ─────────────────────────────────────────────

const createCheckoutRoute = createRoute({
  method: "post",
  path: "/subscriptions/checkout",
  tags: ["Subscriptions"],
  summary: "Create Stripe checkout session",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: { "application/json": { schema: createCheckoutSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.object({ url: z.string() }) }),
        },
      },
      description: "Stripe checkout URL",
    },
  },
});

router.openapi(createCheckoutRoute, async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const result = await subsService.createCheckoutSession(user.id, user.email, body);
  return c.json({ success: true as const, data: result });
});

// ─── POST /subscriptions/portal ───────────────────────────────────────────────

const createPortalRoute = createRoute({
  method: "post",
  path: "/subscriptions/portal",
  tags: ["Subscriptions"],
  summary: "Create Stripe customer portal session",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: { "application/json": { schema: createPortalSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.object({ url: z.string() }) }),
        },
      },
      description: "Stripe portal URL",
    },
  },
});

router.openapi(createPortalRoute, async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const result = await subsService.createPortalSession(user.id, body);
  return c.json({ success: true as const, data: result });
});

// ─── POST /subscriptions/cancel ───────────────────────────────────────────────

const cancelSubscriptionRoute = createRoute({
  method: "post",
  path: "/subscriptions/cancel",
  tags: ["Subscriptions"],
  summary: "Cancel subscription",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true) }),
        },
      },
      description: "Subscription canceled",
    },
  },
});

router.openapi(cancelSubscriptionRoute, async (c) => {
  const user = c.get("user");
  await subsService.cancelSubscription(user.id);
  return c.json({ success: true as const });
});

// ─── POST /subscriptions/validate-coupon ─────────────────────────────────────

const validateCouponRoute = createRoute({
  method: "post",
  path: "/subscriptions/validate-coupon",
  tags: ["Subscriptions"],
  summary: "Validate a coupon code",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: { "application/json": { schema: applyCouponSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              valid: z.boolean(),
              discountDescription: z.string().optional(),
            }),
          }),
        },
      },
      description: "Coupon validation result",
    },
  },
});

router.openapi(validateCouponRoute, async (c) => {
  const { code, planId } = c.req.valid("json");
  const { valid, discountDescription } = await subsService.validateCoupon(code, planId);
  return c.json({ success: true as const, data: { valid, discountDescription } });
});

// ─── GET /subscriptions/me/payments ──────────────────────────────────────────

const listPaymentsRoute = createRoute({
  method: "get",
  path: "/subscriptions/me/payments",
  tags: ["Subscriptions"],
  summary: "Get payment history",
  middleware: [requireAuth] as const,
  request: { query: listPaymentsSchema },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(paymentSchema),
            meta: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
              hasNextPage: z.boolean(),
              hasPreviousPage: z.boolean(),
            }),
          }),
        },
      },
      description: "Payment history",
    },
  },
});

router.openapi(listPaymentsRoute, async (c) => {
  const user = c.get("user");
  const query = c.req.valid("query");

  const result = await subsService.getPaymentHistory(user.id, query);
  return c.json({
    success: true as const,
    data: result.data.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
    meta: result.meta,
  });
});

// ─── Admin: GET /admin/coupons ────────────────────────────────────────────────

const listCouponsRoute = createRoute({
  method: "get",
  path: "/admin/coupons",
  tags: ["Admin", "Subscriptions"],
  summary: "List coupons (admin)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    query: z.object({ isActive: z.coerce.boolean().optional() }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(couponSchema) }),
        },
      },
      description: "List of coupons",
    },
  },
});

router.openapi(listCouponsRoute, async (c) => {
  const { isActive } = c.req.valid("query");
  const coupons = await subsService.listCoupons(isActive);
  return c.json({
    success: true as const,
    data: coupons.map((cp) => ({
      ...cp,
      validFrom: cp.validFrom?.toISOString() ?? null,
      validUntil: cp.validUntil?.toISOString() ?? null,
      createdAt: cp.createdAt.toISOString(),
    })),
  });
});

// ─── Admin: POST /admin/coupons ───────────────────────────────────────────────

const createCouponRoute = createRoute({
  method: "post",
  path: "/admin/coupons",
  tags: ["Admin", "Subscriptions"],
  summary: "Create coupon (admin)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    body: {
      content: { "application/json": { schema: createCouponSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: couponSchema }),
        },
      },
      description: "Created coupon",
    },
  },
});

router.openapi(createCouponRoute, async (c) => {
  const body = c.req.valid("json");
  const coupon = await subsService.createCoupon(body);
  return c.json(
    {
      success: true as const,
      data: {
        ...coupon,
        validFrom: coupon.validFrom?.toISOString() ?? null,
        validUntil: coupon.validUntil?.toISOString() ?? null,
        createdAt: coupon.createdAt.toISOString(),
      },
    },
    201
  );
});

// ─── Admin: PATCH /admin/coupons/:id ─────────────────────────────────────────

const updateCouponRoute = createRoute({
  method: "patch",
  path: "/admin/coupons/{id}",
  tags: ["Admin", "Subscriptions"],
  summary: "Update coupon (admin)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: updateCouponSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: couponSchema }),
        },
      },
      description: "Updated coupon",
    },
  },
});

router.openapi(updateCouponRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const coupon = await subsService.updateCoupon(id, body);
  return c.json({
    success: true as const,
    data: {
      ...coupon,
      validFrom: coupon.validFrom?.toISOString() ?? null,
      validUntil: coupon.validUntil?.toISOString() ?? null,
      createdAt: coupon.createdAt.toISOString(),
    },
  });
});

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeSubscription(sub: { id: string; userId: string; planId: string; status: string; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; cancelAt: Date | null; canceledAt: Date | null; trialEnd: Date | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: sub.id,
    userId: sub.userId,
    planId: sub.planId,
    status: sub.status as "active" | "past_due" | "canceled" | "trialing" | "paused",
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: sub.cancelAt?.toISOString() ?? null,
    canceledAt: sub.canceledAt?.toISOString() ?? null,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

export { router as subscriptionsRouter };
