import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth.js";
import * as gdprService from "../../services/gdpr.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";

type Env = { Variables: { user: { id: string; role: string; email: string; name: string }; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

const dataExportRateLimit = createRateLimiter(1, 86400, "data-export");
const deletionRateLimit = createRateLimiter(2, 86400, "account-deletion");

// ─── GET /users/me/data-export ────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "get",
    path: "/users/me/data-export",
    tags: ["Profile"],
    summary: "Export all personal data (GDPR Article 20)",
    middleware: [requireAuth, dataExportRateLimit] as const,
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.record(z.unknown()) }) } },
        description: "Full data export",
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const context = {
      ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
      ua: c.req.header("user-agent") ?? undefined,
    };
    const data = await gdprService.exportUserData(user.id);

    // Log the export request for compliance audit trail
    const { logAudit } = await import("../../lib/audit.js");
    logAudit(user.id, "user.data_export_requested", "user", user.id, {}, context);

    return c.json({ success: true as const, data }, 200);
  }
);

// ─── DELETE /users/me ─────────────────────────────────────────────────────────

router.openapi(
  createRoute({
    method: "delete",
    path: "/users/me",
    tags: ["Profile"],
    summary: "Request account deletion (GDPR Article 17 — 30-day grace period)",
    middleware: [requireAuth, deletionRateLimit] as const,
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.literal(true), message: z.string() }) } },
        description: "Deletion scheduled",
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const context = {
      ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
      ua: c.req.header("user-agent") ?? undefined,
    };
    await gdprService.requestAccountDeletion(user.id, context);
    return c.json({
      success: true as const,
      message: "Your account has been scheduled for deletion in 30 days. Contact support to cancel.",
    }, 200);
  }
);

export { router as profileRouter };
