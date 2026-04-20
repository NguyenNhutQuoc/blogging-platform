import { uuidv7 } from "uuidv7";
import { slugify } from "@repo/shared/utils";
import { AppError } from "../lib/errors.js";
import * as tagsRepo from "../repositories/tags.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTagInput {
  name: string;
  slug?: string;
  description?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
  description?: string | null;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listTags() {
  return tagsRepo.findAllTags();
}

export async function getTagBySlug(slug: string) {
  const tag = await tagsRepo.findTagBySlug(slug);
  if (!tag) throw AppError.notFound(`Tag "${slug}" not found`);
  return tag;
}

export async function createTag(input: CreateTagInput) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);

  if (!slug) throw AppError.validation("Slug cannot be empty after normalization");
  if (await tagsRepo.tagSlugExists(slug)) {
    throw AppError.conflict(`Tag slug "${slug}" is already taken`);
  }

  return tagsRepo.createTag({
    id: uuidv7(),
    name: input.name,
    slug,
    description: input.description ?? null,
  });
}

export async function updateTag(id: string, input: UpdateTagInput) {
  const existing = await tagsRepo.findTagById(id);
  if (!existing) throw AppError.notFound("Tag not found");

  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = slugify(input.slug);
    if (!slug) throw AppError.validation("Slug cannot be empty after normalization");
    if (await tagsRepo.tagSlugExists(slug, id)) {
      throw AppError.conflict(`Slug "${slug}" is already taken`);
    }
  }

  return tagsRepo.updateTag(id, {
    ...(input.name !== undefined && { name: input.name }),
    slug,
    ...(input.description !== undefined && { description: input.description }),
  });
}

export async function deleteTag(id: string) {
  const existing = await tagsRepo.findTagById(id);
  if (!existing) throw AppError.notFound("Tag not found");

  const deleted = await tagsRepo.deleteTag(id);
  if (!deleted) {
    throw AppError.conflict("Cannot delete a tag that has posts assigned to it");
  }
}
