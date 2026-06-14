import { cookies } from "next/headers";
import Link from "next/link";
import { FileText } from "lucide-react";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import type { PostDetail } from "@repo/api-client";
import { PageHeader } from "@/components/PageHeader";
import { LinkTabs } from "@/components/LinkTabs";
import { StatusBadge } from "@/components/StatusBadge";

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
    <div className="space-y-5">
      <PageHeader
        title="Posts"
        description="Create, edit and publish blog posts"
        actions={
          <Button asChild size="sm">
            <Link href="/admin/posts/new">New post</Link>
          </Button>
        }
      />

      <LinkTabs
        tabs={["", "draft", "published", "scheduled", "archived"].map((s) => ({
          label: s ? s.charAt(0).toUpperCase() + s.slice(1) : "All",
          href: s ? `/admin/posts?status=${s}` : "/admin/posts",
          active: (status ?? "") === s,
        }))}
      />

      {data === null ? (
        <p className="text-sm text-muted-foreground">Failed to load posts.</p>
      ) : data.posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <FileText className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No posts found.</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/admin/posts/new">Create your first post</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <div className="line-clamp-1 font-medium">{post.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">/{post.slug}</div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {post.author.name}
                </TableCell>
                <TableCell>
                  <StatusBadge status={post.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <span>
            Page {page} of {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/posts?page=${page - 1}${status ? `&status=${status}` : ""}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < data.meta.totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/posts?page=${page + 1}${status ? `&status=${status}` : ""}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
