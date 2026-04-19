import { testDb } from "./setup.js";
import { users, posts, categories, tags, postCategories, postTags } from "@repo/database/schema";
import { uuidv7 } from "uuidv7";
import type { UserRole } from "@repo/shared";
import type { User, Post, Category, Tag } from "@repo/database";

// ─── User factory ─────────────────────────────────────────────────────────────

export async function createTestUser(overrides: {
  role?: UserRole;
  email?: string;
  name?: string;
} = {}): Promise<User> {
  const id = uuidv7();
  const [user] = await testDb
    .insert(users)
    .values({
      id,
      email: overrides.email ?? `test-${id}@example.com`,
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "author",
      status: "active",
      emailVerifiedAt: new Date(),
    })
    .returning();
  return user!;
}

// ─── Category factory ─────────────────────────────────────────────────────────

export async function createTestCategory(overrides: {
  name?: string;
  slug?: string;
} = {}): Promise<Category> {
  const id = uuidv7();
  const slug = overrides.slug ?? `category-${id.slice(0, 8)}`;
  const [category] = await testDb
    .insert(categories)
    .values({
      id,
      name: overrides.name ?? "Test Category",
      slug,
    })
    .returning();
  return category!;
}

// ─── Tag factory ──────────────────────────────────────────────────────────────

export async function createTestTag(overrides: {
  name?: string;
  slug?: string;
} = {}): Promise<Tag> {
  const id = uuidv7();
  const slug = overrides.slug ?? `tag-${id.slice(0, 8)}`;
  const [tag] = await testDb
    .insert(tags)
    .values({
      id,
      name: overrides.name ?? "Test Tag",
      slug,
    })
    .returning();
  return tag!;
}

// ─── Post factory ─────────────────────────────────────────────────────────────

export async function createTestPost(
  authorId: string,
  overrides: Partial<{
    title: string;
    slug: string;
    content: string;
    status: "draft" | "published" | "scheduled" | "archived";
    visibility: "free" | "pro" | "premium";
    publishedAt: Date | null;
    scheduledAt: Date | null;
    categoryIds: string[];
    tagIds: string[];
  }> = {}
): Promise<Post> {
  const id = uuidv7();
  const { categoryIds = [], tagIds = [], ...rest } = overrides;

  const [post] = await testDb
    .insert(posts)
    .values({
      id,
      authorId,
      title: rest.title ?? "Test Post",
      slug: rest.slug ?? `test-post-${id.slice(0, 8)}`,
      content: rest.content ?? "<p>Test content</p>",
      status: rest.status ?? "draft",
      visibility: rest.visibility ?? "free",
      publishedAt: rest.publishedAt ?? null,
      scheduledAt: rest.scheduledAt ?? null,
      readingTimeMinutes: 1,
      wordCount: 3,
    })
    .returning();

  if (categoryIds.length > 0) {
    await testDb.insert(postCategories).values(
      categoryIds.map((categoryId) => ({ postId: id, categoryId }))
    );
  }
  if (tagIds.length > 0) {
    await testDb.insert(postTags).values(
      tagIds.map((tagId) => ({ postId: id, tagId }))
    );
  }

  return post!;
}

// ─── Auth session helper ──────────────────────────────────────────────────────

/**
 * Creates a minimal auth cookie header that our test handler can use.
 * In real tests against the API, we insert a session row directly
 * rather than going through the full auth flow.
 */
export function bearerHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
