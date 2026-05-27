import { db } from "../lib/db.js";
import { redirects } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { Redirect } from "@repo/database";
import type { CreateRedirectInput, UpdateRedirectInput } from "@repo/validators/admin";
import { uuidv7 } from "uuidv7";

export async function listRedirects(): Promise<Redirect[]> {
  return db.select().from(redirects).orderBy(redirects.fromPath);
}

export async function findRedirectById(id: string): Promise<Redirect | undefined> {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id));
  return row;
}

export async function findRedirectByFromPath(fromPath: string): Promise<Redirect | undefined> {
  const [row] = await db.select().from(redirects).where(eq(redirects.fromPath, fromPath));
  return row;
}

export async function createRedirect(data: CreateRedirectInput): Promise<Redirect> {
  const [row] = await db.insert(redirects).values({ id: uuidv7(), ...data }).returning();
  return row!;
}

export async function updateRedirect(id: string, data: UpdateRedirectInput): Promise<Redirect | undefined> {
  const [row] = await db.update(redirects).set(data).where(eq(redirects.id, id)).returning();
  return row;
}

export async function deleteRedirect(id: string): Promise<boolean> {
  const [row] = await db.delete(redirects).where(eq(redirects.id, id)).returning({ id: redirects.id });
  return !!row;
}
