"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button, Separator } from "@repo/ui";

interface AdminNavProps {
  user: { name: string; email: string; role?: string };
}

const navLinks = [
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/users", label: "Users", adminOnly: true },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/redirects", label: "Redirects", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/audit-logs", label: "Audit Log", adminOnly: true },
];

export function AdminNav({ user }: AdminNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user.role === "admin";

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-14 items-center justify-between">
          <nav className="flex items-center gap-1 text-sm font-medium">
            <a href="/admin" className="font-bold text-base mr-3">
              Blog Admin
            </a>
            <Separator orientation="vertical" className="h-5 mr-3" />
            {navLinks
              .filter((l) => !l.adminOnly || isAdmin)
              .map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathname.startsWith(link.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {link.label}
                </a>
              ))}
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
