"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader } from "@repo/ui";

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
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-sm font-semibold">Add Redirect</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">From path</label>
            <input
              className="border rounded px-2 py-1.5 text-sm w-48 font-mono"
              placeholder="/old-path"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">To path / URL</label>
            <input
              className="border rounded px-2 py-1.5 text-sm w-64 font-mono"
              placeholder="/new-path"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              className="border rounded px-2 py-1.5 text-sm"
              value={statusCode}
              onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)}
            >
              <option value={301}>301 Permanent</option>
              <option value={302}>302 Temporary</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Adding…" : "Add redirect"}
          </Button>
          {error && <p className="text-xs text-destructive w-full">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
