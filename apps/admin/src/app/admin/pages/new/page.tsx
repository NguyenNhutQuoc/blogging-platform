"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@repo/ui";

export default function NewPagePage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", slug: "", content: "", status: "draft", seoTitle: "", seoDescription: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/v1/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });
    setSaving(false);
    if (res.ok) {
      router.push("/admin/pages");
    } else {
      const body = await res.json() as { error?: { message?: string } };
      setError(body.error?.message ?? "Failed to create page");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">New Page</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: autoSlug(e.target.value) }))} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Slug</label>
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="my-page" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Content (HTML)</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={12}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder="<p>Page content here…</p>"
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
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Page"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
