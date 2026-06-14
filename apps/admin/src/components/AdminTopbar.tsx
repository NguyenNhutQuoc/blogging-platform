"use client";

import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@repo/ui";
import { ThemeToggle } from "./ThemeToggle";

const SECTION_TITLES: [string, string][] = [
  ["/admin/posts", "Posts"],
  ["/admin/pages", "Pages"],
  ["/admin/categories", "Categories"],
  ["/admin/media", "Media"],
  ["/admin/comments", "Comments"],
  ["/admin/users", "Users"],
  ["/admin/redirects", "Redirects"],
  ["/admin/settings", "Settings"],
  ["/admin/audit-logs", "Audit Log"],
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AdminTopbar({
  user,
  onMenuClick,
}: {
  user: { name: string; email: string; role?: string };
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const section = SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Dashboard";

  async function handleSignOut() {
    await fetch("/api/v1/auth/sign-out", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </Button>
        <span className="text-sm font-medium">{section}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="User menu">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                {user.role && (
                  <Badge variant="outline" className="mt-1 capitalize">
                    {user.role}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
