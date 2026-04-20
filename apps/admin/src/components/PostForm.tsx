"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  Badge,
} from "@repo/ui";
import { TiptapEditor, type TiptapOutput } from "./TiptapEditor";
import type { PostDetail } from "@repo/api-client";

interface PostFormProps {
  /** Existing post (when editing) — undefined for new posts */
  post?: PostDetail;
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  scheduledAt: string;
}

/**
 * Create / Edit post form.
 * - Auto-generates slug from title (only on create, not edit)
 * - Tiptap editor outputs HTML + JSON on every keystroke
 * - Separate Save / Publish / Schedule actions
 */
export function PostForm({ post }: PostFormProps) {
  const router = useRouter();
  const isEditing = Boolean(post);

  const [form, setForm] = useState<FormState>({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    coverImageUrl: post?.coverImageUrl ?? "",
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    seoCanonicalUrl: post?.seoCanonicalUrl ?? "",
    scheduledAt: "",
  });

  const [content, setContent] = useState<TiptapOutput>({
    html: post?.content ?? "",
    json: (post?.contentJson as Record<string, unknown>) ?? {},
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(value: string) {
    setField("title", value);
    // Auto-generate slug from title on create only
    if (!isEditing) {
      setField("slug", slugify(value));
    }
  }

  const handleEditorChange = useCallback((output: TiptapOutput) => {
    setContent(output);
  }, []);

  async function submit(action: "draft" | "publish" | "schedule") {
    setError(null);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        content: content.html,
        contentJson: content.json,
        excerpt: form.excerpt || null,
        coverImageUrl: form.coverImageUrl || null,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        seoCanonicalUrl: form.seoCanonicalUrl || null,
        status: action === "draft" ? "draft" : undefined,
      };

      let url: string;
      let method: string;

      if (isEditing && post) {
        url = `/api/v1/posts/${post.id}`;
        method = "PUT";
      } else {
        url = "/api/v1/posts";
        method = "POST";
      }

      // Create or update first
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      type ApiResp = { success: boolean; data?: PostDetail; error?: { message: string } };
      const body = await res.json() as ApiResp;
      if (!body.success) {
        setError(body.error?.message ?? "Save failed");
        return;
      }

      const savedPost = body.data!;

      // Then publish or schedule if requested
      if (action === "publish") {
        await fetch(`/api/v1/posts/${savedPost.id}/publish`, {
          method: "POST",
          credentials: "include",
        });
      } else if (action === "schedule" && form.scheduledAt) {
        await fetch(`/api/v1/posts/${savedPost.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scheduledAt: form.scheduledAt }),
        });
      }

      router.push("/admin/posts");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit("draft");
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Post title"
              required
              className="text-xl h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              placeholder="post-url-slug"
              required
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content</Label>
            <TiptapEditor
              initialHtml={post?.content}
              onChange={handleEditorChange}
              placeholder="Write your post content here…"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm">Status</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {post && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Current:</span>
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>
                    {post.status}
                  </Badge>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => void submit("draft")}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void submit("publish")}
                >
                  {saving ? "Saving…" : post?.status === "published" ? "Update" : "Publish"}
                </Button>
              </div>

              {/* Schedule */}
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowSchedule(!showSchedule)}
              >
                {showSchedule ? "Hide schedule" : "Schedule…"}
              </button>
              {showSchedule && (
                <div className="space-y-2">
                  <Input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setField("scheduledAt", e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={saving || !form.scheduledAt}
                    onClick={() => void submit("schedule")}
                  >
                    Schedule post
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Excerpt & cover */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm">Details</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="excerpt" className="text-xs">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => setField("excerpt", e.target.value)}
                  placeholder="Brief post summary…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coverImageUrl" className="text-xs">Cover image URL</Label>
                <Input
                  id="coverImageUrl"
                  value={form.coverImageUrl}
                  onChange={(e) => setField("coverImageUrl", e.target.value)}
                  placeholder="https://…"
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader className="pb-2">
              <button
                type="button"
                className="text-sm font-semibold hover:text-primary text-left"
                onClick={() => setShowSeo(!showSeo)}
              >
                SEO {showSeo ? "▲" : "▼"}
              </button>
            </CardHeader>
            {showSeo && (
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="seoTitle" className="text-xs">SEO title</Label>
                  <Input
                    id="seoTitle"
                    value={form.seoTitle}
                    onChange={(e) => setField("seoTitle", e.target.value)}
                    placeholder={form.title}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seoDescription" className="text-xs">Meta description</Label>
                  <Textarea
                    id="seoDescription"
                    value={form.seoDescription}
                    onChange={(e) => setField("seoDescription", e.target.value)}
                    placeholder={form.excerpt}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seoCanonicalUrl" className="text-xs">Canonical URL</Label>
                  <Input
                    id="seoCanonicalUrl"
                    value={form.seoCanonicalUrl}
                    onChange={(e) => setField("seoCanonicalUrl", e.target.value)}
                    placeholder="https://…"
                    className="text-sm"
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}

/** Basic slug generator — mirrors the server-side implementation */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
