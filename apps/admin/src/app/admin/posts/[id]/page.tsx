import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { PostForm } from "@/components/PostForm";
import type { PostDetail } from "@repo/api-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);
  return { title: post ? `Edit: ${post.title}` : "Post not found" };
}

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <a
          href="/admin/posts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Posts
        </a>
        <h1 className="text-2xl font-bold">Edit post</h1>
        {post.status === "published" && (
          <a
            href={`/${post.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline ml-auto"
          >
            View live ↗
          </a>
        )}
      </div>
      <PostForm post={post} />
    </div>
  );
}

async function fetchPost(id: string): Promise<PostDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";

    const res = await fetch(`${API_URL}/api/v1/posts/${id}`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return null;
    type Envelope = { success: boolean; data?: PostDetail };
    const body = (await res.json()) as Envelope;
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  }
}
