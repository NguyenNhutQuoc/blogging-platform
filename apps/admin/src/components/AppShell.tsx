"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

/**
 * Fullscreen admin chrome: fixed sidebar (desktop), overlay sidebar (mobile),
 * sticky topbar, fluid content area. `children` stay server-rendered — they
 * pass through this client boundary as a prop.
 */
export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role?: string };
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r md:block">
        <AdminSidebar isAdmin={isAdmin} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-60 border-r shadow-lg">
            <AdminSidebar isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
