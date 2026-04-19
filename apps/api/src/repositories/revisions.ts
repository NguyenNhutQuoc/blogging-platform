import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { revisions } from "@repo/database/schema";
import type { NewRevision, Revision } from "@repo/database";
import { MAX_REVISIONS_PER_POST } from "@repo/shared/constants";

export async function findRevisionsByPost(postId: string) {
  return db
    .select()
    .from(revisions)
    .where(eq(revisions.postId, postId))
    .orderBy(desc(revisions.revisionNumber));
}

export async function getNextRevisionNumber(postId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`MAX(${revisions.revisionNumber})` })
    .from(revisions)
    .where(eq(revisions.postId, postId));
  return (row?.max ?? 0) + 1;
}

export async function createRevision(data: NewRevision): Promise<Revision> {
  const [revision] = await db.insert(revisions).values(data).returning();
  return revision!;
}

/**
 * Prunes old revisions to stay within MAX_REVISIONS_PER_POST.
 * Deletes the oldest revisions when the limit is exceeded.
 */
export async function pruneRevisions(postId: string): Promise<void> {
  const [row] = await db
    .select({ total: count() })
    .from(revisions)
    .where(eq(revisions.postId, postId));

  const total = row?.total ?? 0;
  if (total <= MAX_REVISIONS_PER_POST) return;

  const excess = total - MAX_REVISIONS_PER_POST;

  // Find the oldest revision IDs to delete
  const oldest = await db
    .select({ id: revisions.id })
    .from(revisions)
    .where(eq(revisions.postId, postId))
    .orderBy(asc(revisions.revisionNumber))
    .limit(excess);

  for (const { id } of oldest) {
    await db.delete(revisions).where(eq(revisions.id, id));
  }
}
