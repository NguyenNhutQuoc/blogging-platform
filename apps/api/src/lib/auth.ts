import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.js";
import * as schema from "@repo/database/schema";
import { env } from "./env.js";
import { emailQueue } from "../jobs/queues.js";
import type { EmailJobData } from "../jobs/workers/email.worker.js";

/**
 * Better Auth instance — configured for dual-mode auth:
 * - Web: session-based (httpOnly cookie, managed by Better Auth)
 * - Mobile-ready: Bearer token via the bearer plugin
 *
 * The drizzle adapter reuses our existing DB connection and schema
 * so we don't need a separate auth database.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verificationTokens,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  socialProviders: {
    // Only register OAuth providers when credentials are set — empty strings cause
    // silent auth failures that are hard to debug.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
      : {}),
  },
  plugins: [
    /**
     * Bearer plugin adds Authorization header support.
     * Mobile clients send: Authorization: Bearer <token>
     * Web clients use cookies automatically via Better Auth session.
     */
    bearer(),
  ],
  trustedOrigins: [env.APP_URL, env.ADMIN_URL],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const jobData: EmailJobData = {
            to: user.email,
            subject: `Welcome to the blog!`,
            template: "welcome",
            props: {
              name: user.name,
              loginUrl: env.APP_URL,
            },
          };
          await emailQueue.add("welcome-email", jobData).catch((err: Error) => {
            // Non-fatal: log but don't block account creation
            console.error("[Auth] Failed to queue welcome email:", err.message);
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
