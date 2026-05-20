import { uuidv7 } from "uuidv7";
import { slugify, estimateReadingTime, countWords } from "@repo/shared/utils";
import { AppError } from "../lib/errors.js";
import { searchIndexQueue } from "../jobs/queues.js";
import * as postsRepo from "../repositories/posts.js";
import * as revisionsRepo from "../repositories/revisions.js";
import * as categoriesRepo from "../repositories/categories.js";
import * as tagsRepo from "../repositories/tags.js";
import { resolveUserVisibilityTier } from "./subscriptions.js";
import type { CreatePostInput, UpdatePostInput, ListPostsInput, SchedulePostInput } from "@repo/validators/post";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostAuthorRole = "admin" | "editor" | "author" | "subscriber";

interface Actor {
  id: string;
  role: PostAuthorRole;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a unique slug from a title, appending a short ID suffix on collision. */
async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  if (!(await postsRepo.slugExists(base, excludeId))) return base;

  // Append a 6-char random suffix to resolve collision
  const suffix = uuidv7().replace(/-/g, "").slice(0, 6);
  return `${base}-${suffix}`;
}

/** Returns true if actor owns the post or has elevated role. */
function canModifyPost(actorId: string, postAuthorId: string, actorRole: PostAuthorRole): boolean {
  return actorId === postAuthorId || actorRole === "admin" || actorRole === "editor";
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listPosts(input: ListPostsInput) {
  const { page, pageSize, status, visibility, categoryId, tagId, authorId, q } = input;

  const { data, total } = await postsRepo.findManyPosts({
    page,
    pageSize,
    status,
    visibility,
    categoryId,
    tagId,
    authorId,
    q,
  });

  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Public post lookup — enforces visibility gating.
 * Pass viewerId to unlock pro/premium posts for paid subscribers.
 */
export async function getPostBySlug(slug: string, viewerId?: string) {
  const post = await postsRepo.findPostBySlug(slug);
  if (!post) throw AppError.notFound(`Post "${slug}" not found`);

  const visibility = post.visibility as "free" | "pro" | "premium";
  if (visibility !== "free") {
    const tier = await resolveUserVisibilityTier(viewerId);
    const tierRank = { free: 0, pro: 1, premium: 2 } as const;
    if (tierRank[tier] < tierRank[visibility]) {
      throw AppError.paymentRequired();
    }
  }

  return post;
}

export async function getPostById(id: string) {
  const post = await postsRepo.findPostById(id);
  if (!post) throw AppError.notFound("Post not found");
  return post;
}

export async function createPost(actor: Actor, input: CreatePostInput) {
  const {
    title,
    slug: inputSlug,
    content,
    contentJson,
    categoryIds = [],
    tagIds = [],
    scheduledAt: scheduledAtStr,
    ...rest
  } = input;

  // Auto-generate slug from title if not provided
  const slug = inputSlug
    ? await validateAndNormalizeSlug(inputSlug)
    : await generateUniqueSlug(title);

  const wordCount = countWords(content ?? "");
  const readingTimeMinutes = estimateReadingTime(content ?? "");

  // Validate scheduledAt only when status is "scheduled"
  if (rest.status === "scheduled" && !scheduledAtStr) {
    throw AppError.validation("scheduledAt is required when status is 'scheduled'");
  }

  const post = await postsRepo.createPost({
    id: uuidv7(),
    authorId: actor.id,
    title,
    slug,
    content: content ?? "",
    contentJson: contentJson ?? null,
    wordCount,
    readingTimeMinutes,
    publishedAt: rest.status === "published" ? new Date() : null,
    scheduledAt: scheduledAtStr ? new Date(scheduledAtStr) : null,
    ...rest,
  });

  await validateCategoryAndTagIds(categoryIds, tagIds);

  // Attach categories and tags (replace strategy — safe on create since post is new)
  await Promise.all([
    postsRepo.setPostCategories(post.id, categoryIds),
    postsRepo.setPostTags(post.id, tagIds),
  ]);

  return postsRepo.findPostById(post.id);
}

export async function updatePost(id: string, actor: Actor, input: UpdatePostInput) {
  const existing = await postsRepo.findPostById(id);
  if (!existing) throw AppError.notFound("Post not found");

  if (!canModifyPost(actor.id, existing.authorId, actor.role)) {
    throw AppError.forbidden("You can only edit your own posts");
  }

  const { slug: inputSlug, content, contentJson, categoryIds, tagIds, scheduledAt: scheduledAtStr, ...rest } = input;

  let slug = existing.slug;
  if (inputSlug && inputSlug !== existing.slug) {
    slug = await validateAndNormalizeSlug(inputSlug, id);
  }

  const wordCount = content !== undefined ? countWords(content) : existing.wordCount ?? 0;
  const readingTimeMinutes =
    content !== undefined ? estimateReadingTime(content) : existing.readingTimeMinutes ?? 1;

  await postsRepo.updatePost(id, {
    ...rest,
    slug,
    ...(content !== undefined && { content }),
    ...(contentJson !== undefined && { contentJson }),
    // Convert string ISO date to Date for the DB layer
    ...(scheduledAtStr !== undefined && {
      scheduledAt: scheduledAtStr ? new Date(scheduledAtStr) : null,
    }),
    wordCount,
    readingTimeMinutes,
    // Preserve publishedAt when updating a published post without changing status
    ...(rest.status === "published" && !existing.publishedAt && { publishedAt: new Date() }),
  });

  // Snapshot revision whenever content changes
  if (content !== undefined && content !== existing.content) {
    const revisionNumber = await revisionsRepo.getNextRevisionNumber(id);
    await revisionsRepo.createRevision({
      id: uuidv7(),
      postId: id,
      editorId: actor.id,
      content: existing.content, // snapshot of the content BEFORE this update
      contentJson: existing.contentJson,
      revisionNumber,
    });
    await revisionsRepo.pruneRevisions(id);
  }

  if (categoryIds !== undefined || tagIds !== undefined) {
    await validateCategoryAndTagIds(categoryIds ?? [], tagIds ?? []);
  }

  if (categoryIds !== undefined) {
    await postsRepo.setPostCategories(id, categoryIds);
  }
  if (tagIds !== undefined) {
    await postsRepo.setPostTags(id, tagIds);
  }

  return postsRepo.findPostById(id);
}

export async function publishPost(id: string, actor: Actor) {
  const existing = await postsRepo.findPostById(id);
  if (!existing) throw AppError.notFound("Post not found");

  if (!canModifyPost(actor.id, existing.authorId, actor.role)) {
    throw AppError.forbidden("You can only publish your own posts");
  }

  if (existing.status === "published") {
    throw AppError.conflict("Post is already published");
  }

  await postsRepo.updatePost(id, {
    status: "published",
    publishedAt: new Date(),
    scheduledAt: null,
  });

  return postsRepo.findPostById(id);
}

export async function schedulePost(id: string, actor: Actor, input: SchedulePostInput) {
  const existing = await postsRepo.findPostById(id);
  if (!existing) throw AppError.notFound("Post not found");

  if (!canModifyPost(actor.id, existing.authorId, actor.role)) {
    throw AppError.forbidden("You can only schedule your own posts");
  }

  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt <= new Date()) {
    throw AppError.validation("scheduledAt must be in the future");
  }

  if (existing.status === "published") {
    throw AppError.conflict("Cannot schedule an already published post");
  }

  await postsRepo.updatePost(id, {
    status: "scheduled",
    scheduledAt,
    publishedAt: null,
  });

  // No separate BullMQ job needed — the publish-scheduled cron (every 1 min)
  // polls for posts WHERE status='scheduled' AND scheduled_at <= NOW().

  return postsRepo.findPostById(id);
}

export async function deletePost(id: string, actor: Actor) {
  const existing = await postsRepo.findPostById(id);
  if (!existing) throw AppError.notFound("Post not found");

  if (!canModifyPost(actor.id, existing.authorId, actor.role)) {
    throw AppError.forbidden("You can only delete your own posts");
  }

  const deleted = await postsRepo.softDeletePost(id);
  if (!deleted) throw AppError.notFound("Post not found");

  // Clear search vector for deleted post so it disappears from FTS results immediately
  await searchIndexQueue.add("delete-post-search-vector", { postId: id, action: "delete" });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function validateCategoryAndTagIds(categoryIds: string[], tagIds: string[]): Promise<void> {
  const [foundCats, foundTags] = await Promise.all([
    categoriesRepo.findCategoriesByIds(categoryIds),
    tagsRepo.findTagsByIds(tagIds),
  ]);
  if (foundCats.length !== categoryIds.length) {
    throw AppError.validation("One or more category IDs do not exist");
  }
  if (foundTags.length !== tagIds.length) {
    throw AppError.validation("One or more tag IDs do not exist");
  }
}

async function validateAndNormalizeSlug(rawSlug: string, excludeId?: string): Promise<string> {
  const slug = slugify(rawSlug);
  if (!slug) throw AppError.validation("Slug cannot be empty after normalization");
  if (await postsRepo.slugExists(slug, excludeId)) {
    throw AppError.conflict(`Slug "${slug}" is already taken`);
  }
  return slug;
}
