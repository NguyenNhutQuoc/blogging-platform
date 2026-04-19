import type { Metadata } from "next";
import { PostForm } from "@/components/PostForm";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <a href="/admin/posts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Posts
        </a>
        <h1 className="text-2xl font-bold">New post</h1>
      </div>
      <PostForm />
    </div>
  );
}
