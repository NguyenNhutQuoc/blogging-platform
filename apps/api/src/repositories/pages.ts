import { db } from "../lib/db.js";
import { pages } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { Page } from "@repo/database";
import type { CreatePageInput, UpdatePageInput } from "@repo/validators/admin";
import { uuidv7 } from "uuidv7";

export async function findPageBySlug(slug: string): Promise<Page | undefined> {
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug));
  return row;
}

export async function findPageById(id: string): Promise<Page | undefined> {
  const [row] = await db.select().from(pages).where(eq(pages.id, id));
  return row;
}

export async function listPages(): Promise<Page[]> {
  return db.select().from(pages).orderBy(pages.slug);
}

export async function createPage(data: CreatePageInput): Promise<Page> {
  const [row] = await db.insert(pages).values({ id: uuidv7(), ...data }).returning();
  return row!;
}

export async function updatePage(id: string, data: UpdatePageInput): Promise<Page | undefined> {
  const [row] = await db.update(pages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return row;
}

export async function deletePage(id: string): Promise<boolean> {
  const [row] = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
  return !!row;
}
