import { z } from "zod";

export const createCheckoutSchema = z.object({
  planId: z.string().min(1),
  interval: z.enum(["monthly", "yearly"]),
  couponCode: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const createPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1),
  planId: z.string().min(1),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  priceMonthyCents: z.number().int().min(0),
  priceYearlyCents: z.number().int().min(0),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
  features: z.array(z.string()).optional(),
  limits: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export const createCouponSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().min(1),
  maxUses: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type CreatePortalInput = z.infer<typeof createPortalSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
