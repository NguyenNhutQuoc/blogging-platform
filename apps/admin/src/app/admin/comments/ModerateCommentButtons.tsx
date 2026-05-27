"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";

export function ModerateCommentButtons({
  commentId,
  currentStatus,
}: {
  commentId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function moderate(status: string) {
    setLoading(status);
    try {
      await fetch(`/api/comments/${commentId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {currentStatus !== "approved" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
          onClick={() => moderate("approved")}
          disabled={!!loading}
        >
          {loading === "approved" ? "…" : "Approve"}
        </Button>
      )}
      {currentStatus !== "spam" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-orange-700 border-orange-200 hover:bg-orange-50"
          onClick={() => moderate("spam")}
          disabled={!!loading}
        >
          {loading === "spam" ? "…" : "Spam"}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        onClick={() => moderate("deleted")}
        disabled={!!loading}
      >
        {loading === "deleted" ? "…" : "Delete"}
      </Button>
    </div>
  );
}
