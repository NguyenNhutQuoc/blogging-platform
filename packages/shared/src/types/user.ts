/** User roles — controls access to content and admin features */
export type UserRole = "admin" | "editor" | "author" | "subscriber";

/** Account status — suspended/banned users cannot authenticate */
export type UserStatus = "active" | "suspended" | "banned";

export interface UserPublic {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: UserRole;
  createdAt: Date;
}
