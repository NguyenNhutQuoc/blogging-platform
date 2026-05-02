import { OpenAPIHono } from "@hono/zod-openapi";
import { handleStripeWebhook } from "../../services/subscriptions.js";
import { AppError } from "../../lib/errors.js";

const router = new OpenAPIHono();

/**
 * POST /webhooks/stripe
 *
 * Stripe sends raw POST requests signed with STRIPE_WEBHOOK_SECRET.
 * We MUST read the raw body text (not parsed JSON) before calling
 * stripe.webhooks.constructEvent() — signature verification will fail
 * if the body is re-serialized.
 *
 * No auth middleware — Stripe calls this directly. Signature is
 * the only authentication.
 */
router.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Missing stripe-signature header" } },
      400
    );
  }

  const rawBody = await c.req.text();

  try {
    await handleStripeWebhook(rawBody, signature);
    return c.json({ success: true, received: true });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.statusCode as 400 | 500
      );
    }
    console.error("[WebhookRoute] Unexpected error:", err);
    return c.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Webhook processing failed" } },
      500
    );
  }
});

export { router as webhooksRouter };
