"use client";

import { useRouter } from "next/navigation";
import { Button, Separator } from "@repo/ui";

interface AdminNavProps {
  user: { name: string; email: string };
}

export function AdminNav({ user }: AdminNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-14 items-center justify-between">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="/admin" className="font-bold text-base">
              Blog Admin
            </a>
            <Separator orientation="vertical" className="h-5" />
            <a
              href="/admin/posts"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Posts
            </a>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
