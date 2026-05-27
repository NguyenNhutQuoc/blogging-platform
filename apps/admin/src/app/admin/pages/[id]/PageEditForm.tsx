"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@repo/ui";

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
      <div className="space-y-1">
        <label className="text-sm font-medium">Title</label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Slug</label>
        <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Content (HTML)</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={14}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>
      <div className="flex gap-4">
        <div className="space-y-1 flex-1">
          <label className="text-sm font-medium">SEO Title</label>
          <Input value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="border rounded-md px-3 py-2 text-sm h-10">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/pages")}>Back to Pages</Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </form>
  );
}
