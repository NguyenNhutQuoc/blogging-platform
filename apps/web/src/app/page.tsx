import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

/**
 * Public blog listing page.
 * Uses Next.js 16 `use cache` directive via cacheTag/cacheLife for ISR-style caching.
 * Revalidated when posts are published (via cache tag invalidation on the API side).
 */
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const data = await fetchPublishedPosts(page);

  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Failed to load posts. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Latest Posts</h1>

      {data.posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No posts yet. Check back soon!
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <div className="mt-8">
            <Pagination
              currentPage={page}
              totalPages={data.meta.totalPages ?? 1}
              baseUrl="/"
            />
          </div>
        </>
      )}
    </div>
  );
}

async function fetchPublishedPosts(page: number) {
  "use cache";
  cacheTag("posts", "posts-list");
  cacheLife("minutes");

  try {
    const result = await api.posts.list({ status: "published", page, pageSize: 12 });
    if (!result.success) return null;
    return { posts: result.data!, meta: result.meta! };
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  return {
    title: "Latest Posts",
    description: "Read the latest articles from our authors.",
  };
}
