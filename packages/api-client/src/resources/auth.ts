import type { ApiClient } from "../client.js";
import type { ApiResponse, UserPublic } from "@repo/shared";

export interface LoginResponse {
  user: UserPublic;
  token?: string; // present in Bearer token mode (mobile)
}

export class AuthResource {
  constructor(private readonly client: ApiClient) {}

  async me(): Promise<ApiResponse<UserPublic>> {
    return this.client.get<UserPublic>("/api/v1/auth/session");
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    return this.client.post<LoginResponse>("/api/v1/auth/sign-in/email", {
      email,
      password,
    });
  }

  async register(name: string, email: string, password: string): Promise<ApiResponse<UserPublic>> {
    return this.client.post<UserPublic>("/api/v1/auth/sign-up/email", {
      name,
      email,
      password,
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.client.post<void>("/api/v1/auth/sign-out", {});
  }
}
