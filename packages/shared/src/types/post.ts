/** Post lifecycle status */
export type PostStatus = "draft" | "published" | "scheduled" | "archived";

/**
 * Visibility tier — controls which subscription level can read the post.
 * Gating logic lives in the API service layer, not in the frontend.
 */
export type PostVisibility = "free" | "pro" | "premium";

/**
 * Dates are ISO 8601 strings — the API serializes Dates to strings before
 * sending, and the api-client never parses JSON dates back to Date objects.
 * Always treat timestamps as strings on the client side.
 */
export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  status: PostStatus;
  visibility: PostVisibility;
  /** ISO 8601 string or null */
  publishedAt?: string | null;
  readingTimeMinutes?: number | null;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}
