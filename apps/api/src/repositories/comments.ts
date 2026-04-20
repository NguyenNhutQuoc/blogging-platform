import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../lib/db.js";
import { comments, users } from "@repo/database/schema";
import type { Comment, NewComment } from "@repo/database";

export interface FindCommentsFilter {
  postId: string;
  status?: "pending" | "approved" | "spam" | "deleted";
  page: number;
  pageSize: number;
}

export async function findCommentsByPost(filter: FindCommentsFilter) {
  const { postId, status, page, pageSize } = filter;
  const offset = (page - 1) * pageSize;

  const statusCondition = status ? eq(comments.status, status) : eq(comments.status, "approved");
  const where = and(eq(comments.postId, postId), isNull(comments.deletedAt), statusCondition);

  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(comments).where(where),
    db
      .select({
        comment: comments,
        author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(where)
      .orderBy(asc(comments.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  return {
    data: rows.map(({ comment, author }) => ({ ...comment, author })),
    total: totalResult[0]?.total ?? 0,
  };
}

export async function findCommentById(id: string): Promise<Comment | null> {
  const [row] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)));
  return row ?? null;
}

export async function createComment(data: NewComment): Promise<Comment> {
  const [comment] = await db.insert(comments).values(data).returning();
  return comment!;
}

export async function updateCommentStatus(
  id: string,
  status: "pending" | "approved" | "spam" | "deleted"
): Promise<Comment | null> {
  const [updated] = await db
    .update(comments)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function updateCommentContent(id: string, content: string): Promise<Comment | null> {
  const [updated] = await db
    .update(comments)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function softDeleteComment(id: string): Promise<boolean> {
  const [deleted] = await db
    .update(comments)
    .set({ deletedAt: new Date(), status: "deleted", updatedAt: new Date() })
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
    .returning({ id: comments.id });
  return !!deleted;
}
