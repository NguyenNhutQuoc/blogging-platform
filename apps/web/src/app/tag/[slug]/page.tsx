import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const [tag, data] = await Promise.all([
    fetchTag(slug),
    fetchPostsByTag(slug, page),
  ]);

  if (!tag) notFound();

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1">Tag</p>
        <h1 className="text-3xl font-bold">#{tag.name}</h1>
      </div>

      {data && data.posts.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {data.posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
          <div className="mt-8">
            <Pagination currentPage={page} totalPages={data.meta.totalPages ?? 1} baseUrl={`/tag/${slug}`} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground py-8">No posts tagged with this tag yet.</p>
      )}
    </div>
  );
}

async function fetchTag(slug: string) {
  "use cache";
  cacheTag(`tag-${slug}`);
  cacheLife("hours");
  try {
    const result = await api.get<{ id: string; name: string; slug: string }>(`/api/v1/tags/${slug}`);
    return result.success ? result.data! : null;
  } catch { return null; }
}

async function fetchPostsByTag(slug: string, page: number) {
  "use cache";
  cacheTag(`posts-tag-${slug}`, "posts");
  cacheLife("minutes");
  try {
    const tagResult = await api.get<{ id: string }>(`/api/v1/tags/${slug}`);
    if (!tagResult.success) return null;
    const result = await api.posts.list({ status: "published", tagId: tagResult.data!.id, page, pageSize: 12 });
    return result.success ? { posts: result.data!, meta: result.meta! } : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await fetchTag(slug);
  if (!tag) return { title: "Tag not found" };
  return {
    title: `#${tag.name} posts`,
    description: `Browse all posts tagged with ${tag.name}`,
  };
}
