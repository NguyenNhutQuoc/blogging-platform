import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps, softDelete } from "./helpers";

export const userRoleEnum = pgEnum("user_role", ["admin", "editor", "author", "subscriber"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "banned"]);

export const users = pgTable(
  "users",
  {
    id: primaryId(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: userRoleEnum("role").notNull().default("subscriber"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    /** Flexible metadata bag — stores provider-specific data, preferences, etc. */
    metadata: jsonb("metadata"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("idx_users_email").on(t.email),
    index("idx_users_role").on(t.role),
    index("idx_users_status").on(t.status),
  ]
);

/**
 * Better Auth manages sessions internally.
 * We define the table here so Drizzle can generate the migration
 * and so we have type-safe references from other tables.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: primaryId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("idx_sessions_user").on(t.userId)]
);

/** OAuth provider accounts linked to a user (Google, GitHub, etc.) */
export const accounts = pgTable(
  "accounts",
  {
    id: primaryId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("idx_accounts_user").on(t.userId),
    uniqueIndex("idx_accounts_provider").on(t.provider, t.providerAccountId),
  ]
);

export const verificationTokens = pgTable("verification_tokens", {
  id: primaryId(),
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
