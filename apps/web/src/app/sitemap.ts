import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Dynamic sitemap — fetches all published posts, categories, and tags
 * from the API at build time (or on-demand in ISR).
 *
 * Next.js generates /sitemap.xml from this file automatically.
 * Listed in robots.ts so crawlers find it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags] = await Promise.all([
    fetchAllPublishedPosts(),
    fetchAllCategories(),
    fetchAllTags(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${APP_URL}/search`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${APP_URL}/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${APP_URL}/category/${cat.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${APP_URL}/tag/${tag.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes];
}

async function fetchAllPublishedPosts() {
  try {
    // Fetch up to 1000 posts for the sitemap — adjust pageSize if needed
    const result = await api.posts.list({ status: "published", page: 1, pageSize: 1000 });
    return result.success ? result.data! : [];
  } catch {
    return [];
  }
}

async function fetchAllCategories() {
  try {
    const result = await api.get<Array<{ id: string; name: string; slug: string }>>(
      "/api/v1/categories?pageSize=200"
    );
    return result.success ? result.data! : [];
  } catch {
    return [];
  }
}

async function fetchAllTags() {
  try {
    const result = await api.get<Array<{ id: string; name: string; slug: string }>>(
      "/api/v1/tags?pageSize=500"
    );
    return result.success ? result.data! : [];
  } catch {
    return [];
  }
}
