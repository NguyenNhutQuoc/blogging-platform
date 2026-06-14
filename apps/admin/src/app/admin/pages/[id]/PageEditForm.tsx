"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@repo/ui";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function PageEditForm({ page }: { page: Page }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: page.title,
    slug: page.slug,
    content: page.content,
    status: page.status,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch(`/api/v1/admin/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const body = await res.json() as { error?: { message?: string } };
      setError(body.error?.message ?? "Failed to save");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
      </div>
      <div className="space-y-1.5">
        <Label>Slug</Label>
        <Input className="font-mono text-sm" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
      </div>
      <div className="space-y-1.5">
        <Label>Content (HTML)</Label>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={14}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label>SEO Title</Label>
          <Input value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/pages")}>Back to pages</Button>
        {saved && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Saved!</span>}
      </div>
    </form>
  );
}
