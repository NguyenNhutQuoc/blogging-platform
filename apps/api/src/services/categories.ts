import { uuidv7 } from "uuidv7";
import { slugify } from "@repo/shared/utils";
import { AppError } from "../lib/errors.js";
import * as categoriesRepo from "../repositories/categories.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  coverImageUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  coverImageUrl?: string | null;
  sortOrder?: number;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listCategories() {
  return categoriesRepo.findAllCategories();
}

export async function getCategoryBySlug(slug: string) {
  const cat = await categoriesRepo.findCategoryBySlug(slug);
  if (!cat) throw AppError.notFound(`Category "${slug}" not found`);
  return cat;
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);

  if (!slug) throw AppError.validation("Slug cannot be empty after normalization");
  if (await categoriesRepo.slugExistsForCategory(slug)) {
    throw AppError.conflict(`Category slug "${slug}" is already taken`);
  }

  if (input.parentId) {
    const parent = await categoriesRepo.findCategoryById(input.parentId);
    if (!parent) throw AppError.notFound("Parent category not found");
  }

  return categoriesRepo.createCategory({
    id: uuidv7(),
    name: input.name,
    slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
    coverImageUrl: input.coverImageUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await categoriesRepo.findCategoryById(id);
  if (!existing) throw AppError.notFound("Category not found");

  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = slugify(input.slug);
    if (!slug) throw AppError.validation("Slug cannot be empty after normalization");
    if (await categoriesRepo.slugExistsForCategory(slug, id)) {
      throw AppError.conflict(`Slug "${slug}" is already taken`);
    }
  } else if (input.name && !input.slug) {
    // Auto-update slug only if name changed and no explicit slug provided
    slug = existing.slug; // keep current slug — don't auto-change existing slugs
  }

  return categoriesRepo.updateCategory(id, {
    ...(input.name !== undefined && { name: input.name }),
    slug,
    ...(input.description !== undefined && { description: input.description }),
    ...(input.parentId !== undefined && { parentId: input.parentId }),
    ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
  });
}

export async function deleteCategory(id: string) {
  const existing = await categoriesRepo.findCategoryById(id);
  if (!existing) throw AppError.notFound("Category not found");

  const deleted = await categoriesRepo.deleteCategory(id);
  if (!deleted) {
    throw AppError.conflict("Cannot delete a category that has posts assigned to it");
  }
}
