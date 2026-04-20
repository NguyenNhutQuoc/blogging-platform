import { cookies } from "next/headers";
import { Button, Badge } from "@repo/ui";
import type { PostDetail } from "@repo/api-client";

/**
 * Admin posts listing — shows all posts (all statuses), not cached.
 * Fetched server-side with session cookie forwarded to the API.
 */
export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const data = await fetchAdminPosts({ status, page });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <a href="/admin/posts/new">
          <Button>New post</Button>
        </a>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 text-sm">
        {["", "draft", "published", "scheduled", "archived"].map((s) => (
          <a
            key={s}
            href={s ? `/admin/posts?status=${s}` : "/admin/posts"}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              (status ?? "") === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s || "All"}
          </a>
        ))}
      </div>

      {data === null ? (
        <p className="text-muted-foreground">Failed to load posts.</p>
      ) : data.posts.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No posts found.
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                  Author
                </th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">
                  Date
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.posts.map((post) => (
                <tr
                  key={post.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium line-clamp-1">{post.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      /{post.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {post.author.name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/posts/${post.id}`}
                      className="text-primary hover:underline text-xs font-medium"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <a
              href={`/admin/posts?page=${page - 1}${status ? `&status=${status}` : ""}`}
            >
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </a>
          )}
          <span className="text-sm text-muted-foreground self-center">
            Page {page} of {data.meta.totalPages}
          </span>
          {page < data.meta.totalPages && (
            <a
              href={`/admin/posts?page=${page + 1}${status ? `&status=${status}` : ""}`}
            >
              <Button variant="outline" size="sm">
                Next
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PostDetail["status"] }) {
  const variants: Record<
    PostDetail["status"],
    "default" | "secondary" | "outline" | "destructive"
  > = {
    published: "default",
    draft: "secondary",
    scheduled: "outline",
    archived: "destructive",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

async function fetchAdminPosts(params: { status?: string; page: number }) {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";

    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: "20",
      ...(params.status ? { status: params.status } : {}),
    });

    const res = await fetch(`${API_URL}/api/v1/posts?${qs}`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return null;
    type Envelope = {
      success: boolean;
      data: PostDetail[];
      meta: { totalPages: number };
    };
    const body = (await res.json()) as Envelope;
    return body.success ? { posts: body.data, meta: body.meta } : null;
  } catch {
    return null;
  }
}
