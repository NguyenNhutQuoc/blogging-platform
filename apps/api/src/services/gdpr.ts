import { db } from "../lib/db.js";
import {
  posts, comments, subscriptions, newsletterSubscribers,
} from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { Post, Comment, Subscription, NewsletterSubscriber } from "@repo/database";
import { AppError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { gdprQueue } from "../jobs/queues.js";
import * as userRepo from "../repositories/users.js";

/** Collect all data we hold about a user and return it as a JSON-serializable bundle. */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const user = await userRepo.findUserById(userId);
  if (!user) throw AppError.notFound("User not found");

  const [userPosts, userComments, userSubscriptions, userNewsletterSubs] = await Promise.all([
    db.select().from(posts).where(eq(posts.authorId, userId)),
    db.select().from(comments).where(eq(comments.authorId, userId)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, user.email)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
    posts: userPosts.map((p: Post) => ({ id: p.id, title: p.title, status: p.status, createdAt: p.createdAt })),
    comments: userComments.map((c: Comment) => ({ id: c.id, content: c.content, status: c.status, createdAt: c.createdAt })),
    subscriptions: userSubscriptions.map((s: Subscription) => ({ id: s.id, status: s.status, createdAt: s.createdAt })),
    newsletterSubscriptions: userNewsletterSubs.map((n: NewsletterSubscriber) => ({ id: n.id, email: n.email, status: n.status, subscribedAt: n.subscribedAt })),
  };
}

/**
 * Soft-delete the account immediately (anonymize email so no PII remains),
 * then schedule a hard-delete job 30 days out for grace-period recovery.
 */
export async function requestAccountDeletion(
  userId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<void> {
  const user = await userRepo.findUserById(userId);
  if (!user) throw AppError.notFound("User not found");

  await userRepo.softDeleteUser(userId);
  logAudit(userId, "user.deletion_requested", "user", userId, {}, context);

  const deleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await gdprQueue.add(
    `hard-delete-${userId}`,
    { type: "hard-delete", userId },
    { delay: deleteAt.getTime() - Date.now(), jobId: `hard-delete-${userId}` }
  );
}
