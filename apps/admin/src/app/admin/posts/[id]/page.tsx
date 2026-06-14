import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-b pb-4">
        <Link
          href="/admin/posts"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Posts
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-lg font-semibold tracking-tight">Edit post</h1>
        {post.status === "published" && (
          <a
            href={`/${post.slug}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View live <ExternalLink className="size-3" />
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
