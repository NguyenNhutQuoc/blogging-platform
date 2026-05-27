"use client";

import { useState } from "react";
import { Button } from "@repo/ui";

export function DeletePageButton({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/v1/admin/pages/${pageId}`, { method: "DELETE", credentials: "include" });
    window.location.reload();
  }

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={handleDelete}
      className="text-xs h-6 px-2 text-destructive hover:text-destructive">
      Delete
    </Button>
  );
}
