import { z } from "zod";

export const trackPageViewSchema = z.object({
  path: z.string().min(1).max(2048),
  postId: z.string().optional(),
  sessionId: z.string().min(1).max(128),
  referrer: z.string().max(2048).optional(),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
});

export const trackReactionSchema = z.object({
  postId: z.string().min(1),
  reactionType: z.enum(["like", "love", "insightful", "bookmark"]),
  sessionId: z.string().min(1).max(128),
});

export const trackReadingProgressSchema = z.object({
  postId: z.string().min(1),
  sessionId: z.string().min(1).max(128),
  scrollDepthPercent: z.number().int().min(0).max(100),
  timeSpentSeconds: z.number().int().min(0),
  finishedReading: z.boolean().optional().default(false),
});

export const analyticsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export const postAnalyticsQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export type TrackPageViewInput = z.infer<typeof trackPageViewSchema>;
export type TrackReactionInput = z.infer<typeof trackReactionSchema>;
export type TrackReadingProgressInput = z.infer<typeof trackReadingProgressSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
export type PostAnalyticsQueryInput = z.infer<typeof postAnalyticsQuerySchema>;
