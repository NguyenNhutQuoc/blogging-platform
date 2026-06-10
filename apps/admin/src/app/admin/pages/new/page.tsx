"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="max-w-2xl space-y-5">
      <PageHeader title="New page" description="Static content page" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: autoSlug(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input className="font-mono text-sm" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="my-page" required />
        </div>
        <div className="space-y-1.5">
          <Label>Content (HTML)</Label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={12}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            placeholder="<p>Page content here…</p>"
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
        <div className="flex gap-3 border-t pt-4">
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create page"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
