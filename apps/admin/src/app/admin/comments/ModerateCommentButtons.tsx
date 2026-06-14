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
          size="xs"
          variant="outline"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          onClick={() => moderate("approved")}
          disabled={!!loading}
          loading={loading === "approved"}
        >
          Approve
        </Button>
      )}
      {currentStatus !== "spam" && (
        <Button
          size="xs"
          variant="outline"
          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          onClick={() => moderate("spam")}
          disabled={!!loading}
          loading={loading === "spam"}
        >
          Spam
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => moderate("deleted")}
        disabled={!!loading}
        loading={loading === "deleted"}
      >
        Delete
      </Button>
    </div>
  );
}
