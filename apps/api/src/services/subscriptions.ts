import { uuidv7 } from "uuidv7";
import { stripe } from "../lib/stripe.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { emailQueue } from "../jobs/queues.js";
import * as subsRepo from "../repositories/subscriptions.js";
import type {
  CreateCheckoutInput,
  CreatePortalInput,
  ListPaymentsInput,
  CreateCouponInput,
  UpdateCouponInput,
} from "@repo/validators/subscription";
import type { SubscriptionPlan, Subscription, Coupon } from "@repo/database";
import type Stripe from "stripe";

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function listPlans(): Promise<SubscriptionPlan[]> {
  return subsRepo.listActivePlans();
}

// ─── Current subscription ─────────────────────────────────────────────────────

export async function getMySubscription(
  userId: string
): Promise<{ subscription: Subscription; plan: SubscriptionPlan } | null> {
  const subscription = await subsRepo.findActiveSubscriptionByUserId(userId);
  if (!subscription) return null;

  const plan = await subsRepo.findPlanById(subscription.planId);
  if (!plan) return null;

  return { subscription, plan };
}

/** Resolves the maximum visibility tier the user can access. */
export async function resolveUserVisibilityTier(
  userId: string | undefined
): Promise<"free" | "pro" | "premium"> {
  if (!userId) return "free";

  const result = await getMySubscription(userId);
  if (!result) return "free";

  const { plan } = result;
  if (plan.slug === "premium") return "premium";
  if (plan.slug === "pro") return "pro";
  return "free";
}

// ─── Coupon validation ────────────────────────────────────────────────────────

export async function validateCoupon(
  code: string,
  _planId: string
): Promise<{ valid: boolean; coupon?: Coupon; discountDescription?: string }> {
  const coupon = await subsRepo.findCouponByCode(code);

  if (!coupon || !coupon.isActive) {
    return { valid: false };
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return { valid: false };
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false };
  }
  if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
    return { valid: false };
  }

  const discountDescription =
    coupon.discountType === "percentage"
      ? `${coupon.discountValue}% off`
      : `$${(coupon.discountValue / 100).toFixed(2)} off`;

  return { valid: true, coupon, discountDescription };
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  input: CreateCheckoutInput
): Promise<{ url: string }> {
  const plan = await subsRepo.findPlanById(input.planId);
  if (!plan || !plan.isActive) {
    throw AppError.notFound("Subscription plan not found");
  }

  const priceId =
    input.interval === "monthly"
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

  if (!priceId) {
    throw AppError.internal(
      `No Stripe price configured for ${plan.name} (${input.interval})`
    );
  }

  const existing = await subsRepo.findActiveSubscriptionByUserId(userId);
  if (existing) {
    throw new AppError(
      "SUBSCRIPTION_ALREADY_ACTIVE" as never,
      "You already have an active subscription. Use the customer portal to make changes.",
      409
    );
  }

  if (input.couponCode) {
    const { valid } = await validateCoupon(input.couponCode, input.planId);
    if (!valid) {
      throw AppError.invalidCoupon(
        "Coupon code is invalid, expired, or has reached its usage limit"
      );
    }
  }

  const successUrl = input.successUrl ?? `${env.APP_URL}/subscription/success`;
  const cancelUrl = input.cancelUrl ?? `${env.APP_URL}/pricing`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: plan.slug === "pro" ? 14 : undefined,
        metadata: {
          userId,
          planId: plan.id,
          couponCode: input.couponCode ?? "",
        },
      },
      metadata: { userId, planId: plan.id },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw AppError.internal("Stripe checkout session URL not returned");
    }

    return { url: session.url };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    throw AppError.stripeError(message);
  }
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function createPortalSession(
  userId: string,
  input: CreatePortalInput
): Promise<{ url: string }> {
  const subscription = await subsRepo.findActiveSubscriptionByUserId(userId);
  if (!subscription?.stripeCustomerId) {
    throw AppError.notFound("No active subscription found");
  }

  const returnUrl = input.returnUrl ?? `${env.APP_URL}/account`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    throw AppError.stripeError(message);
  }
}

// ─── Cancel subscription ──────────────────────────────────────────────────────

export async function cancelSubscription(userId: string): Promise<void> {
  const subscription = await subsRepo.findActiveSubscriptionByUserId(userId);
  if (!subscription) {
    throw AppError.notFound("No active subscription found");
  }

  if (subscription.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Stripe error";
      throw AppError.stripeError(message);
    }
  }

  await subsRepo.updateSubscription(subscription.id, {
    status: "canceled",
    canceledAt: new Date(),
  });
}

// ─── Payment history ──────────────────────────────────────────────────────────

export async function getPaymentHistory(userId: string, input: ListPaymentsInput) {
  const { data, total } = await subsRepo.listPaymentsByUserId(
    userId,
    input.page,
    input.pageSize
  );
  const totalPages = Math.ceil(total / input.pageSize);

  return {
    data,
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages,
      hasNextPage: input.page < totalPages,
      hasPreviousPage: input.page > 1,
    },
  };
}

// ─── Stripe webhook handler ───────────────────────────────────────────────────

export async function handleStripeWebhook(
  rawBody: string,
  signature: string
): Promise<void> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    throw new AppError(
      "VALIDATION_ERROR" as never,
      `Webhook signature verification failed: ${message}`,
      400
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}

// ─── Webhook event handlers ───────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  if (!userId || !planId || !session.subscription || !session.customer) return;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer.id;

  const existing = await subsRepo.findSubscriptionByStripeId(stripeSubscriptionId);
  if (existing) return;

  // In Stripe v22, current_period_start/end are not on Subscription type directly.
  // Retrieve subscription and use billing_cycle_anchor as a fallback.
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const sub = stripeSub as unknown as {
    status: string;
    billing_cycle_anchor: number;
    trial_end: number | null;
    cancel_at: number | null;
  };

  await subsRepo.createSubscription({
    id: uuidv7(),
    userId,
    planId,
    stripeSubscriptionId,
    stripeCustomerId,
    status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "paused",
    currentPeriodStart: new Date(sub.billing_cycle_anchor * 1000),
    currentPeriodEnd: null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });

  const plan = await subsRepo.findPlanById(planId);
  if (!plan) return;

  const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
  if (stripeCustomer.deleted) return;

  const customerEmail = stripeCustomer.email ?? "";
  const customerName =
    typeof stripeCustomer.name === "string" ? stripeCustomer.name : "Subscriber";

  if (customerEmail) {
    await emailQueue.add("subscription-activated", {
      to: customerEmail,
      subject: `Your ${plan.name} subscription is active!`,
      template: "subscription-activated" as const,
      props: {
        name: customerName,
        planName: plan.name,
        planFeatures: (plan.features as string[]) ?? [],
        renewalDate: "your next billing date",
        manageUrl: `${env.APP_URL}/account/subscription`,
      },
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // In Stripe v22, subscription reference is in invoice.parent.subscription_details.subscription
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await subsRepo.findSubscriptionByStripeId(subscriptionId);
  if (!subscription) return;

  await subsRepo.updateSubscription(subscription.id, {
    status: "active",
    currentPeriodStart: new Date(invoice.period_start * 1000),
    currentPeriodEnd: new Date(invoice.period_end * 1000),
  });

  await subsRepo.createPaymentRecord({
    id: uuidv7(),
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripeInvoiceId: invoice.id ?? null,
    stripePaymentIntentId: getInvoicePaymentIntentId(invoice),
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    status: "succeeded",
    description:
      invoice.description ??
      `${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} subscription`,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await subsRepo.findSubscriptionByStripeId(subscriptionId);
  if (!subscription) return;

  await subsRepo.updateSubscription(subscription.id, { status: "past_due" });

  await subsRepo.createPaymentRecord({
    id: uuidv7(),
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripeInvoiceId: invoice.id ?? null,
    stripePaymentIntentId: getInvoicePaymentIntentId(invoice),
    amountCents: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    description: "Payment failed",
  });

  const plan = await subsRepo.findPlanById(subscription.planId);
  if (!plan || !subscription.stripeCustomerId) return;

  const stripeCustomer = await stripe.customers.retrieve(
    subscription.stripeCustomerId
  );
  if (stripeCustomer.deleted) return;

  const customerEmail = stripeCustomer.email ?? "";
  const customerName =
    typeof stripeCustomer.name === "string" ? stripeCustomer.name : "Subscriber";

  if (customerEmail) {
    await emailQueue.add("payment-failed", {
      to: customerEmail,
      subject: "Action needed: Your payment failed",
      template: "payment-failed" as const,
      props: {
        name: customerName,
        planName: plan.name,
        amountFormatted: `$${(invoice.amount_due / 100).toFixed(2)}`,
        updatePaymentUrl: `${env.APP_URL}/account/subscription`,
      },
    });
  }
}

async function handleSubscriptionUpdated(
  stripeSub: Stripe.Subscription
): Promise<void> {
  const subscription = await subsRepo.findSubscriptionByStripeId(stripeSub.id);
  if (!subscription) return;

  const sub = stripeSub as unknown as {
    status: string;
    cancel_at: number | null;
    trial_end: number | null;
  };

  await subsRepo.updateSubscription(subscription.id, {
    status: sub.status as "active" | "trialing" | "past_due" | "canceled" | "paused",
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });
}

async function handleSubscriptionDeleted(
  stripeSub: Stripe.Subscription
): Promise<void> {
  const subscription = await subsRepo.findSubscriptionByStripeId(stripeSub.id);
  if (!subscription) return;

  await subsRepo.updateSubscription(subscription.id, {
    status: "canceled",
    canceledAt: new Date(),
  });

  const plan = await subsRepo.findPlanById(subscription.planId);
  if (!plan || !subscription.stripeCustomerId) return;

  const stripeCustomer = await stripe.customers.retrieve(
    subscription.stripeCustomerId
  );
  if (stripeCustomer.deleted) return;

  const customerEmail = stripeCustomer.email ?? "";
  const customerName =
    typeof stripeCustomer.name === "string" ? stripeCustomer.name : "Subscriber";

  if (customerEmail) {
    const accessUntil =
      subscription.currentPeriodEnd
        ? subscription.currentPeriodEnd.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "the end of your billing period";

    await emailQueue.add("subscription-canceled", {
      to: customerEmail,
      subject: `Your ${plan.name} subscription has been canceled`,
      template: "subscription-canceled" as const,
      props: {
        name: customerName,
        planName: plan.name,
        accessUntil,
        resubscribeUrl: `${env.APP_URL}/pricing`,
      },
    });
  }
}

// ─── Stripe v22 helpers ───────────────────────────────────────────────────────

/**
 * In Stripe v22 (dahlia), the subscription reference on an invoice moved from
 * invoice.subscription (string) to invoice.parent.subscription_details.subscription.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;

  const sub = subDetails.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * In Stripe v22, payment_intent moved from invoice.payment_intent to
 * invoice.confirmation_secret.payment_intent (nested in payment_details).
 * We access it via unknown cast since types don't expose it cleanly.
 */
function getInvoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    payment_intent?: string | { id: string } | null;
    confirmation_secret?: { payment_intent?: { id: string } | string | null } | null;
  };

  if (raw.payment_intent) {
    return typeof raw.payment_intent === "string"
      ? raw.payment_intent
      : raw.payment_intent.id;
  }

  const pi = raw.confirmation_secret?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

// ─── Admin: coupon management ─────────────────────────────────────────────────

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const existing = await subsRepo.findCouponByCode(input.code);
  if (existing) {
    throw AppError.conflict(`Coupon code "${input.code}" already exists`);
  }

  return subsRepo.createCoupon({
    id: uuidv7(),
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    discountType: input.discountType,
    discountValue: input.discountValue,
    maxUses: input.maxUses ?? null,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
    isActive: input.isActive ?? true,
  });
}

export async function updateCoupon(
  id: string,
  input: UpdateCouponInput
): Promise<Coupon> {
  const updated = await subsRepo.updateCoupon(id, {
    ...(input.description !== undefined && { description: input.description }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
    ...(input.validFrom !== undefined && {
      validFrom: new Date(input.validFrom),
    }),
    ...(input.validUntil !== undefined && {
      validUntil: new Date(input.validUntil),
    }),
  });

  if (!updated) throw AppError.notFound("Coupon not found");
  return updated;
}

export async function listCoupons(isActive?: boolean): Promise<Coupon[]> {
  return subsRepo.listCoupons(isActive);
}
