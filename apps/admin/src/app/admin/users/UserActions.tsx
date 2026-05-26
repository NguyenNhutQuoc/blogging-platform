"use client";

import { useState } from "react";
import { Button } from "@repo/ui";

interface UserActionsProps {
  userId: string;
  currentRole: string;
  currentStatus: string;
}

export function UserActions({ userId, currentRole, currentStatus }: UserActionsProps) {
  const [loading, setLoading] = useState(false);

  async function changeRole(role: string) {
    setLoading(true);
    await fetch(`/api/v1/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
      credentials: "include",
    });
    setLoading(false);
    window.location.reload();
  }

  async function changeStatus(status: string) {
    setLoading(true);
    await fetch(`/api/v1/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    });
    setLoading(false);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-1">
      <select
        defaultValue={currentRole}
        disabled={loading}
        onChange={(e) => changeRole(e.target.value)}
        className="border rounded px-1.5 py-0.5 text-xs"
      >
        <option value="subscriber">subscriber</option>
        <option value="author">author</option>
        <option value="editor">editor</option>
        <option value="admin">admin</option>
      </select>
      {currentStatus === "active" ? (
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => changeStatus("suspended")}
          className="text-xs h-6 px-2 text-yellow-600 hover:text-yellow-700">
          Suspend
        </Button>
      ) : (
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => changeStatus("active")}
          className="text-xs h-6 px-2 text-green-600 hover:text-green-700">
          Restore
        </Button>
      )}
    </div>
  );
}
