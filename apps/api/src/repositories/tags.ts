import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { tags, postTags } from "@repo/database/schema";
import type { Tag, NewTag } from "@repo/database";

export async function findAllTags() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function findTagsByIds(ids: string[]): Promise<Tag[]> {
  if (ids.length === 0) return [];
  return db.select().from(tags).where(inArray(tags.id, ids));
}

export async function findTagById(id: string): Promise<Tag | null> {
  const [row] = await db.select().from(tags).where(eq(tags.id, id));
  return row ?? null;
}

export async function findTagBySlug(slug: string): Promise<Tag | null> {
  const [row] = await db.select().from(tags).where(eq(tags.slug, slug));
  return row ?? null;
}

export async function tagSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);

  if (excludeId) return rows.some((r) => r.id !== excludeId);
  return rows.length > 0;
}

export async function createTag(data: NewTag): Promise<Tag> {
  const [tag] = await db.insert(tags).values(data).returning();
  return tag!;
}

export async function updateTag(id: string, data: Partial<Pick<Tag, "name" | "slug" | "description">>): Promise<Tag | null> {
  const [updated] = await db
    .update(tags)
    .set(data)
    .where(eq(tags.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTag(id: string): Promise<boolean> {
  // Check if any posts use this tag
  const [usage] = await db
    .select({ count: count() })
    .from(postTags)
    .where(eq(postTags.tagId, id));

  if ((usage?.count ?? 0) > 0) return false;

  const [deleted] = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  return !!deleted;
}
