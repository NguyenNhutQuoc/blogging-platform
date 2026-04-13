import type { ApiResponse } from "@repo/shared";

export interface ApiClientConfig {
  baseUrl: string;
  /**
   * Optional function to get the auth token.
   * - Web (Next.js server components): return null (cookies are forwarded automatically)
   * - Mobile: return the stored Bearer token
   */
  getToken?: () => string | null | Promise<string | null>;
  /** Called on 401 — useful for redirecting to login page */
  onUnauthorized?: () => void;
}

/**
 * Base API client — wraps fetch with:
 * - Typed response envelope unwrapping
 * - Automatic Authorization header for mobile/Bearer token mode
 * - Consistent error handling
 *
 * Used by both web (server components pass headers directly) and
 * future mobile clients (React Native with stored tokens).
 */
export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.config.getToken?.();

    // Normalize incoming headers to a plain Record — options.headers can be
    // Headers | string[][] | Record<string,string>, so we convert explicitly.
    const incomingHeaders: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => { incomingHeaders[k] = v; });
      } else if (Array.isArray(options.headers)) {
        for (const [k, v] of options.headers) {
          incomingHeaders[k] = v;
        }
      } else {
        Object.assign(incomingHeaders, options.headers as Record<string, string>);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...incomingHeaders,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.config.onUnauthorized?.();
    }

    const data = (await response.json()) as ApiResponse<T>;
    return data;
  }

  get<T>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body: unknown, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown, options?: RequestInit) {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
