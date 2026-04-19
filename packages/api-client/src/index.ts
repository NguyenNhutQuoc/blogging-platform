export { ApiClient } from "./client.js";
export type { ApiClientConfig } from "./client.js";
export { PostsResource } from "./resources/posts.js";
export { AuthResource } from "./resources/auth.js";
export { CommentsResource } from "./resources/comments.js";
export type { PostDetail, ListPostsParams } from "./resources/posts.js";
export type { LoginResponse } from "./resources/auth.js";
export type { Comment } from "./resources/comments.js";

import { ApiClient } from "./client.js";
import { PostsResource } from "./resources/posts.js";
import { AuthResource } from "./resources/auth.js";
import { CommentsResource } from "./resources/comments.js";

/**
 * Factory function to create a configured API client instance.
 * Exposes both resource-specific helpers (posts, auth, comments)
 * and generic HTTP methods (get, post, put, patch, delete) for
 * endpoints not covered by a resource class.
 */
export function createApiClient(baseUrl: string, getToken?: () => string | null) {
  const client = new ApiClient({ baseUrl, getToken });
  return {
    posts: new PostsResource(client),
    auth: new AuthResource(client),
    comments: new CommentsResource(client),
    // Expose generic methods for routes not covered by a resource class
    get: client.get.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),
    patch: client.patch.bind(client),
    delete: client.delete.bind(client),
  };
}
