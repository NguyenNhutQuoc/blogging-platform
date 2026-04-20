import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PostCard } from "@/components/PostCard";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * Search results page — NOT cached (queries are dynamic per user input).
 * Client-side debounced search will be added in Step 8 (admin editor).
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  if (!q || q.trim().length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Search</h1>
        <SearchForm query="" />
      </div>
    );
  }

  const results = await fetchSearchResults(q.trim());

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Search</h1>
      <SearchForm query={q} />

      {results === null ? (
        <p className="text-muted-foreground mt-8">Search failed. Please try again.</p>
      ) : results.data.length === 0 ? (
        <p className="text-muted-foreground mt-8">
          No results found for <strong>"{q}"</strong>.
        </p>
      ) : (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground mb-6">
            {results.meta.total} result{results.meta.total !== 1 ? "s" : ""} for{" "}
            <strong>"{q}"</strong>
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {results.data.map((post) => (
              <PostCard
                key={post.id}
                // Search results don't include coverImageUrl/categories/tags —
                // PostCard accepts these as optional so we pass empty defaults.
                post={{ ...post, coverImageUrl: null, categories: [], tags: [] }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchForm({ query }: { query: string }) {
  return (
    <form method="GET" action="/search" className="mt-4">
      <div className="flex gap-2 max-w-xl">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search posts…"
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoFocus
        />
        <button
          type="submit"
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}

type SearchResultSet = {
  data: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: string | null;
    readingTimeMinutes: number | null;
    author: { id: string; name: string; avatarUrl: string | null };
    rank: number;
    highlight: string | null;
  }>;
  meta: { q: string; total: number };
};

async function fetchSearchResults(q: string): Promise<SearchResultSet | null> {
  try {
    const result = await api.get<SearchResultSet>(
      `/api/v1/search?q=${encodeURIComponent(q)}&pageSize=20`
    );
    return result.success ? result.data! : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: "${q}"` : "Search",
  };
}
