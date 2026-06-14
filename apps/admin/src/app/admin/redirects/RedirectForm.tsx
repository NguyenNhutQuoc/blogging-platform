"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@repo/ui";

export function RedirectForm() {
  const router = useRouter();
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<301 | 302>(301);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fromPath, toPath, statusCode, isActive: true }),
      });
      const body = await res.json() as { success: boolean; error?: { message: string } };
      if (!body.success) { setError(body.error?.message ?? "Failed to create redirect"); return; }
      setFromPath("");
      setToPath("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5 text-sm font-medium">Add redirect</div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From path</label>
          <Input
            className="h-8 w-48 font-mono text-sm"
            placeholder="/old-path"
            value={fromPath}
            onChange={(e) => setFromPath(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To path / URL</label>
          <Input
            className="h-8 w-64 font-mono text-sm"
            placeholder="/new-path"
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={statusCode}
            onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)}
          >
            <option value={301}>301 Permanent</option>
            <option value={302}>302 Temporary</option>
          </select>
        </div>
        <Button type="submit" size="sm" loading={loading}>
          {loading ? "Adding…" : "Add redirect"}
        </Button>
        {error && <p className="w-full text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}
