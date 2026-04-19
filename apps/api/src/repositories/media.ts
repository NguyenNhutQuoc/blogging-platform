import { desc, eq, isNull, and, count } from "drizzle-orm";
import { db } from "../lib/db.js";
import { media } from "@repo/database/schema";
import type { Media, NewMedia } from "@repo/database";

export async function findMediaById(id: string): Promise<Media | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id));
  return row ?? null;
}

export async function findMediaByUploader(uploaderId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(media).where(eq(media.uploaderId, uploaderId)),
    db
      .select()
      .from(media)
      .where(eq(media.uploaderId, uploaderId))
      .orderBy(desc(media.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);
  return { data: rows, total: totalResult[0]?.total ?? 0 };
}

export async function createMedia(data: NewMedia): Promise<Media> {
  const [row] = await db.insert(media).values(data).returning();
  return row!;
}

export async function updateMedia(id: string, data: Partial<NewMedia>): Promise<Media | null> {
  const [updated] = await db
    .update(media)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(media.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteMedia(id: string): Promise<boolean> {
  const [deleted] = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id });
  return !!deleted;
}
