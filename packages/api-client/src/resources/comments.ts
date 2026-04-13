import type { ApiClient } from "../client.js";
import type { ApiResponse } from "@repo/shared";

export interface Comment {
  id: string;
  postId: string;
  authorId?: string | null;
  parentId?: string | null;
  content: string;
  status: "pending" | "approved" | "spam" | "deleted";
  guestName?: string | null;
  author?: { id: string; name: string; avatarUrl?: string | null } | null;
  replies?: Comment[];
  createdAt: string;
}

export class CommentsResource {
  constructor(private readonly client: ApiClient) {}

  async list(postId: string): Promise<ApiResponse<Comment[]>> {
    return this.client.get<Comment[]>(`/api/v1/posts/${postId}/comments`);
  }

  async create(postId: string, data: Record<string, unknown>): Promise<ApiResponse<Comment>> {
    return this.client.post<Comment>(`/api/v1/posts/${postId}/comments`, data);
  }

  async update(commentId: string, content: string): Promise<ApiResponse<Comment>> {
    return this.client.put<Comment>(`/api/v1/comments/${commentId}`, { content });
  }

  async delete(commentId: string): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/api/v1/comments/${commentId}`);
  }
}
