import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostForm } from "@/components/PostForm";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage() {
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
        <h1 className="text-lg font-semibold tracking-tight">New post</h1>
      </div>
      <PostForm />
    </div>
  );
}
