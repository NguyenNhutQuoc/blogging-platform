import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../lib/db.js";
import { categories, postCategories } from "@repo/database/schema";
import type { Category, NewCategory } from "@repo/database";

export async function findAllCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function findCategoriesByIds(ids: string[]): Promise<Category[]> {
  if (ids.length === 0) return [];
  return db.select().from(categories).where(inArray(categories.id, ids));
}

export async function findCategoryById(id: string): Promise<Category | null> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  return row ?? null;
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug));
  return row ?? null;
}

export async function slugExistsForCategory(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      excludeId
        ? and(eq(categories.slug, slug))
        : eq(categories.slug, slug)
    )
    .limit(1);

  if (excludeId) {
    return rows.some((r) => r.id !== excludeId);
  }
  return rows.length > 0;
}

export async function createCategory(data: NewCategory): Promise<Category> {
  const [cat] = await db.insert(categories).values(data).returning();
  return cat!;
}

export async function updateCategory(id: string, data: Partial<NewCategory>): Promise<Category | null> {
  const [updated] = await db
    .update(categories)
    .set(data)
    .where(eq(categories.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  // Check if any posts use this category
  const [usage] = await db
    .select({ count: count() })
    .from(postCategories)
    .where(eq(postCategories.categoryId, id));

  if ((usage?.count ?? 0) > 0) return false;

  const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  return !!deleted;
}
