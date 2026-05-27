import { logAudit } from "../lib/audit.js";
import * as repo from "../repositories/settings.js";
import type { UpsertSettingsInput } from "@repo/validators/admin";

export async function getAllSettings(): Promise<Record<string, unknown>> {
  return repo.getAllSettings();
}

export async function getSetting(key: string): Promise<unknown> {
  const row = await repo.getSetting(key);
  return row?.value ?? null;
}

export async function upsertSettings(
  input: UpsertSettingsInput,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<Record<string, unknown>> {
  await repo.bulkUpsertSettings(input, actorId);
  logAudit(actorId, "settings.updated", "site_settings", null, { new: input }, context);
  return repo.getAllSettings();
}
