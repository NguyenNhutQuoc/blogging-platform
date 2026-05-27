import { db } from "../lib/db.js";
import { siteSettings } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import type { SiteSetting } from "@repo/database";

export async function getSetting(key: string): Promise<SiteSetting | undefined> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
  return row;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map((r: { key: string; value: unknown }) => [r.key, r.value]));
}

export async function upsertSetting(key: string, value: unknown, updatedBy: string): Promise<SiteSetting> {
  const [row] = await db.insert(siteSettings)
    .values({ key, value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function bulkUpsertSettings(
  entries: Record<string, unknown>,
  updatedBy: string
): Promise<void> {
  if (Object.keys(entries).length === 0) return;
  await Promise.all(Object.entries(entries).map(([key, value]) => upsertSetting(key, value, updatedBy)));
}
