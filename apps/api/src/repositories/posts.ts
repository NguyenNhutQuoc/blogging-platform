import { and, desc, eq, ilike, isNull, sql, inArray, count } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  posts,
  users,
  categories,
  tags,
  postCategories,
  postTags,
} from "@repo/database/schema";
import type { Post, NewPost } from "@repo/database";

// ─── Filter / pagination params ───────────────────────────────────────────────

export interface ListPostsFilter {
  page: number;
  pageSize: number;
  status?: "draft" | "published" | "scheduled" | "archived";
  visibility?: "free" | "pro" | "premium";
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  /** Full-text search query — uses PostgreSQL tsvector GIN index */
  q?: string;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns paginated posts with joined author, categories, and tags.
 * When `q` is provided, results are ranked by ts_rank.
 */
export async function findManyPosts(filter: ListPostsFilter) {
  const { page, pageSize, status, visibility, categoryId, tagId, authorId, q } = filter;
  const offset = (page - 1) * pageSize;

  // Build the WHERE conditions dynamically
  const conditions = [isNull(posts.deletedAt)];

  if (status) conditions.push(eq(posts.status, status));
  if (visibility) conditions.push(eq(posts.visibility, visibility));
  if (authorId) conditions.push(eq(posts.authorId, authorId));

  if (q) {
    conditions.push(
      sql`${posts.searchVector} @@ websearch_to_tsquery('simple', ${q})`
    );
  }

  if (categoryId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${postCategories}
        WHERE ${postCategories.postId} = ${posts.id}
        AND ${postCategories.categoryId} = ${categoryId}
      )`
    );
  }

  if (tagId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${postTags}
        WHERE ${postTags.postId} = ${posts.id}
        AND ${postTags.tagId} = ${tagId}
      )`
    );
  }

  const where = and(...conditions);

  // Run count + data queries in parallel
  const [totalResult, rows] = await Promise.all([
    db.select({ total: count() }).from(posts).where(where),
    db
      .select({
        post: posts,
        author: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          email: users.email,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(where)
      .orderBy(
        q
          ? sql`ts_rank(${posts.searchVector}, websearch_to_tsquery('simple', ${q})) DESC`
          : desc(posts.publishedAt)
      )
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // Batch-fetch categories and tags for the returned post IDs
  const postIds = rows.map((r) => r.post.id);
  const [postCats, postTagRows] = await Promise.all([
    postIds.length
      ? db
          .select({ postId: postCategories.postId, category: categories })
          .from(postCategories)
          .innerJoin(categories, eq(postCategories.categoryId, categories.id))
          .where(inArray(postCategories.postId, postIds))
      : [],
    postIds.length
      ? db
          .select({ postId: postTags.postId, tag: tags })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(inArray(postTags.postId, postIds))
      : [],
  ]);

  // Group categories and tags by postId for O(n) merge
  const catsByPost = new Map<string, (typeof postCats)[number]["category"][]>();
  const tagsByPost = new Map<string, (typeof postTagRows)[number]["tag"][]>();

  for (const { postId, category } of postCats) {
    const list = catsByPost.get(postId) ?? [];
    list.push(category);
    catsByPost.set(postId, list);
  }
  for (const { postId, tag } of postTagRows) {
    const list = tagsByPost.get(postId) ?? [];
    list.push(tag);
    tagsByPost.set(postId, list);
  }

  const data = rows.map(({ post, author }) => ({
    ...post,
    author,
    categories: catsByPost.get(post.id) ?? [],
    tags: tagsByPost.get(post.id) ?? [],
  }));

  return { data, total };
}

export async function findPostById(id: string) {
  const [row] = await db
    .select({
      post: posts,
      author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl, email: users.email },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)));

  if (!row) return null;

  const [postCats, postTagRows] = await Promise.all([
    db
      .select({ category: categories })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, id)),
    db
      .select({ tag: tags })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, id)),
  ]);

  return {
    ...row.post,
    author: row.author,
    categories: postCats.map((r) => r.category),
    tags: postTagRows.map((r) => r.tag),
  };
}

export async function findPostBySlug(slug: string) {
  const [row] = await db
    .select({
      post: posts,
      author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.slug, slug), isNull(posts.deletedAt)));

  if (!row) return null;

  const [postCats, postTagRows] = await Promise.all([
    db
      .select({ category: categories })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, row.post.id)),
    db
      .select({ tag: tags })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, row.post.id)),
  ]);

  return {
    ...row.post,
    author: row.author,
    categories: postCats.map((r) => r.category),
    tags: postTagRows.map((r) => r.tag),
  };
}

export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const conditions = [eq(posts.slug, slug), isNull(posts.deletedAt)];
  if (excludeId) conditions.push(sql`${posts.id} != ${excludeId}`);

  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(...conditions))
    .limit(1);

  return !!row;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createPost(data: NewPost): Promise<Post> {
  const [post] = await db.insert(posts).values(data).returning();
  return post!;
}

export async function updatePost(id: string, data: Partial<NewPost>): Promise<Post | null> {
  const [updated] = await db
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function softDeletePost(id: string): Promise<boolean> {
  const [deleted] = await db
    .update(posts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning({ id: posts.id });
  return !!deleted;
}

// ─── Relations ────────────────────────────────────────────────────────────────

/** Replaces all category associations for a post (delete + re-insert). */
export async function setPostCategories(postId: string, categoryIds: string[]): Promise<void> {
  await db.delete(postCategories).where(eq(postCategories.postId, postId));
  if (categoryIds.length > 0) {
    await db.insert(postCategories).values(categoryIds.map((categoryId) => ({ postId, categoryId })));
  }
}

/** Replaces all tag associations for a post (delete + re-insert). */
export async function setPostTags(postId: string, tagIds: string[]): Promise<void> {
  await db.delete(postTags).where(eq(postTags.postId, postId));
  if (tagIds.length > 0) {
    await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
  }
}
