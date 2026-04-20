import { api } from "@/lib/api";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SITE_TITLE = "Blog Platform";
const SITE_DESCRIPTION = "A professional multi-author blogging platform.";

/**
 * RSS 2.0 feed — GET /rss.xml
 * Returns the 20 most recent published posts.
 *
 * Why a Route Handler and not a static file?
 * Content changes constantly — we want fresh items without a redeploy.
 * Cache: 1 hour (revalidate: 3600).
 */
export async function GET() {
  const posts = await fetchRecentPosts();

  const items = posts
    .map((post) => {
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      const postUrl = `${APP_URL}/${post.slug}`;
      const excerpt = escapeXml(post.excerpt ?? "");

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(post.author.name)}</author>
      ${excerpt ? `<description>${excerpt}</description>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${APP_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${APP_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

async function fetchRecentPosts() {
  try {
    const result = await api.posts.list({ status: "published", page: 1, pageSize: 20 });
    return result.success ? result.data! : [];
  } catch {
    return [];
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
