import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().max(100).optional(),
});

export const createNewsletterSchema = z.object({
  subject: z.string().min(1).max(255),
  previewText: z.string().max(255).optional(),
  contentHtml: z.string().min(1),
  contentText: z.string().optional(),
});

export const updateNewsletterSchema = createNewsletterSchema.partial();

export const scheduleNewsletterSchema = z.object({
  scheduledAt: z.string().datetime({ message: "scheduledAt must be an ISO 8601 datetime" }),
});

export const unsubscribeSchema = z.object({
  token: z.string().min(1),
});

export const listSubscribersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["active", "unsubscribed", "bounced", "complained"]).optional(),
  q: z.string().optional(),
});

export const listNewslettersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["draft", "scheduled", "sending", "sent"]).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type CreateNewsletterInput = z.infer<typeof createNewsletterSchema>;
export type UpdateNewsletterInput = z.infer<typeof updateNewsletterSchema>;
export type ScheduleNewsletterInput = z.infer<typeof scheduleNewsletterSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
export type ListSubscribersInput = z.infer<typeof listSubscribersSchema>;
export type ListNewslettersInput = z.infer<typeof listNewslettersSchema>;
