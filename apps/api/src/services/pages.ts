import { AppError } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import * as repo from "../repositories/pages.js";
import type { Page } from "@repo/database";
import type { CreatePageInput, UpdatePageInput } from "@repo/validators/admin";

export async function getPageBySlug(slug: string): Promise<Page> {
  const page = await repo.findPageBySlug(slug);
  if (!page) throw AppError.notFound("Page not found");
  return page;
}

export async function listPages(): Promise<Page[]> {
  return repo.listPages();
}

export async function createPage(
  input: CreatePageInput,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<Page> {
  const existing = await repo.findPageBySlug(input.slug);
  if (existing) throw new AppError("CONFLICT", `Page with slug "${input.slug}" already exists`, 409);

  const page = await repo.createPage(input);
  logAudit(actorId, "page.created", "page", page.id, { new: { slug: page.slug, title: page.title } }, context);
  return page;
}

export async function updatePage(
  id: string,
  input: UpdatePageInput,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<Page> {
  const existing = await repo.findPageById(id);
  if (!existing) throw AppError.notFound("Page not found");

  const updated = await repo.updatePage(id, input);
  if (!updated) throw AppError.notFound("Page not found");

  logAudit(actorId, "page.updated", "page", id, { old: { title: existing.title }, new: { title: updated.title } }, context);
  return updated;
}

export async function deletePage(
  id: string,
  actorId: string,
  context: { ip?: string; ua?: string } = {}
): Promise<void> {
  const existing = await repo.findPageById(id);
  if (!existing) throw AppError.notFound("Page not found");

  await repo.deletePage(id);
  logAudit(actorId, "page.deleted", "page", id, { old: { slug: existing.slug } }, context);
}
