"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";

export function DeleteRedirectButton({ redirectId }: { redirectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this redirect?")) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/redirects/${redirectId}`, { method: "DELETE", credentials: "include" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs" onClick={handleDelete} disabled={loading}>
      {loading ? "…" : "Delete"}
    </Button>
  );
}
