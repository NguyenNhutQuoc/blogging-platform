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

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const [category, data] = await Promise.all([
    fetchCategory(slug),
    fetchPostsByCategory(slug, page),
  ]);

  if (!category) notFound();

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1">Category</p>
        <h1 className="text-3xl font-bold">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground mt-2">{category.description}</p>
        )}
      </div>

      {data && data.posts.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {data.posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
          <div className="mt-8">
            <Pagination currentPage={page} totalPages={data.meta.totalPages ?? 1} baseUrl={`/category/${slug}`} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground py-8">No posts in this category yet.</p>
      )}
    </div>
  );
}

async function fetchCategory(slug: string) {
  "use cache";
  cacheTag(`category-${slug}`);
  cacheLife("hours");
  try {
    const result = await api.get<{ name: string; description: string | null }>(`/api/v1/categories/${slug}`);
    return result.success ? result.data! : null;
  } catch { return null; }
}

async function fetchPostsByCategory(slug: string, page: number) {
  "use cache";
  cacheTag(`posts-category-${slug}`, "posts");
  cacheLife("minutes");
  try {
    // First get the category to get its ID
    const catResult = await api.get<{ id: string }>(`/api/v1/categories/${slug}`);
    if (!catResult.success) return null;
    const result = await api.posts.list({ status: "published", categoryId: catResult.data!.id, page, pageSize: 12 });
    return result.success ? { posts: result.data!, meta: result.meta! } : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} posts`,
    description: category.description ?? `Browse all posts in ${category.name}`,
  };
}
