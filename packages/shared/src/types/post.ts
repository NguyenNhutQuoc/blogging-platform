/** Post lifecycle status */
export type PostStatus = "draft" | "published" | "scheduled" | "archived";

/**
 * Visibility tier — controls which subscription level can read the post.
 * Gating logic lives in the API service layer, not in the frontend.
 */
export type PostVisibility = "free" | "pro" | "premium";

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  status: PostStatus;
  visibility: PostVisibility;
  publishedAt?: Date | null;
  readingTimeMinutes?: number | null;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}
