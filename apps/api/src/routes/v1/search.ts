import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "../../lib/db.js";
import { posts, users } from "@repo/database/schema";
import { and, desc, isNull, sql } from "drizzle-orm";

const router = new OpenAPIHono();

const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  readingTimeMinutes: z.number().nullable(),
  author: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().nullable() }),
  /** ts_rank score for result ordering — higher is more relevant */
  rank: z.number(),
  /** Highlighted snippet from content with matched terms wrapped in <b> tags */
  highlight: z.string().nullable(),
});

const searchResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(searchResultSchema),
  meta: z.object({
    q: z.string(),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * Full-text search over published posts using PostgreSQL tsvector.
 *
 * Uses `websearch_to_tsquery` which handles:
 *   - AND: "nextjs typescript"
 *   - OR: "nextjs OR remix"
 *   - phrases: '"server components"'
 *   - negation: "nextjs -javascript"
 *
 * The GIN index on search_vector makes this O(log n) on the indexed terms.
 * Results are ranked by ts_rank (frequency-based) and include a ts_headline
 * snippet with matched terms wrapped in <b> tags.
 *
 * Phase 5+: swap this for Meilisearch by updating this route only.
 */
router.openapi(
  createRoute({
    method: "get",
    path: "/search",
    tags: ["Search"],
    summary: "Full-text search",
    description:
      "Searches published posts by title, excerpt, and content. " +
      "Uses PostgreSQL full-text search (tsvector + GIN index). " +
      "Supports AND, OR, phrase, and negation via websearch_to_tsquery syntax.",
    request: {
      query: z.object({
        q: z.string().min(1).max(255),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(10),
      }),
    },
    responses: {
      200: { content: { "application/json": { schema: searchResponseSchema } }, description: "OK" },
    },
  }),
  async (c) => {
    const { q, page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
        readingTimeMinutes: posts.readingTimeMinutes,
        author: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
        rank: sql<number>`ts_rank(${posts.searchVector}, websearch_to_tsquery('simple', ${q}))`,
        highlight: sql<string | null>`
          ts_headline(
            'simple',
            ${posts.content},
            websearch_to_tsquery('simple', ${q}),
            'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=false, MaxFragments=3'
          )
        `,
      })
      .from(posts)
      .innerJoin(users, sql`${posts.authorId} = ${users.id}`)
      .where(
        and(
          isNull(posts.deletedAt),
          sql`${posts.status} = 'published'`,
          sql`${posts.searchVector} @@ websearch_to_tsquery('simple', ${q})`
        )
      )
      .orderBy(
        desc(sql`rank`)
      )
      .limit(pageSize)
      .offset(offset);

    // For total count we run a separate COUNT query
    const [countRow] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(posts)
      .where(
        and(
          isNull(posts.deletedAt),
          sql`${posts.status} = 'published'`,
          sql`${posts.searchVector} @@ websearch_to_tsquery('simple', ${q})`
        )
      );

    const total = countRow?.total ?? 0;

    return c.json({
      success: true as const,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt ?? null,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        readingTimeMinutes: r.readingTimeMinutes ?? null,
        author: r.author,
        rank: r.rank,
        highlight: r.highlight ?? null,
      })),
      meta: { q, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }, 200);
  }
);

export { router as searchRouter };
