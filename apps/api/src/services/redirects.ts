import { AppError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import * as repo from "../repositories/redirects.js";
import type { Redirect } from "@repo/database";
import type { CreateRedirectInput, UpdateRedirectInput } from "@repo/validators/admin";

export async function listRedirects(): Promise<Redirect[]> {
  return repo.listRedirects();
}

export async function createRedirect(
  input: CreateRedirectInput,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<Redirect> {
  const existing = await repo.findRedirectByFromPath(input.fromPath);
  if (existing) throw new AppError("CONFLICT", `Redirect from "${input.fromPath}" already exists`, 409);

  const redirect = await repo.createRedirect(input);
  logAudit(actorId, "redirect.created", "redirect", redirect.id, { new: { fromPath: redirect.fromPath, toPath: redirect.toPath } }, context);
  return redirect;
}

export async function updateRedirect(
  id: string,
  input: UpdateRedirectInput,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<Redirect> {
  const existing = await repo.findRedirectById(id);
  if (!existing) throw AppError.notFound("Redirect not found");

  const updated = await repo.updateRedirect(id, input);
  if (!updated) throw AppError.notFound("Redirect not found");

  logAudit(actorId, "redirect.updated", "redirect", id, { old: { fromPath: existing.fromPath }, new: input }, context);
  return updated;
}

export async function deleteRedirect(
  id: string,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<void> {
  const existing = await repo.findRedirectById(id);
  if (!existing) throw AppError.notFound("Redirect not found");

  await repo.deleteRedirect(id);
  logAudit(actorId, "redirect.deleted", "redirect", id, { old: { fromPath: existing.fromPath } }, context);
}
