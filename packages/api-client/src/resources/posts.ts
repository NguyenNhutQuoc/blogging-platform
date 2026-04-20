import type { ApiClient } from "../client.js";
import type { PostSummary, ApiResponse } from "@repo/shared";

export interface PostDetail extends PostSummary {
  content: string;
  contentJson?: Record<string, unknown> | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  ogImageUrl?: string | null;
  wordCount?: number | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
}

export interface ListPostsParams {
  page?: number;
  pageSize?: number;
  status?: "draft" | "published" | "scheduled" | "archived";
  visibility?: "free" | "pro" | "premium";
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  q?: string;
}

export class PostsResource {
  constructor(private readonly client: ApiClient) {}

  /**
   * Lists posts. Returns `ApiResponse<PostDetail[]>` — the array is in `data`,
   * pagination info is in `meta` of the response envelope.
   */
  async list(params?: ListPostsParams): Promise<ApiResponse<PostDetail[]>> {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => [k, String(v)])
          )
        ).toString()
      : "";
    return this.client.get<PostDetail[]>(`/api/v1/posts${qs}`);
  }

  async getBySlug(slug: string): Promise<ApiResponse<PostDetail>> {
    return this.client.get<PostDetail>(`/api/v1/posts/${slug}`);
  }

  async create(data: Record<string, unknown>): Promise<ApiResponse<PostDetail>> {
    return this.client.post<PostDetail>("/api/v1/posts", data);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ApiResponse<PostDetail>> {
    return this.client.put<PostDetail>(`/api/v1/posts/${id}`, data);
  }

  async publish(id: string): Promise<ApiResponse<PostDetail>> {
    return this.client.post<PostDetail>(`/api/v1/posts/${id}/publish`, {});
  }

  async schedule(id: string, scheduledAt: string): Promise<ApiResponse<PostDetail>> {
    return this.client.post<PostDetail>(`/api/v1/posts/${id}/schedule`, { scheduledAt });
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/posts/${id}`);
  }
}
