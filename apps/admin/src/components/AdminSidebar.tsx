"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Files,
  Tags,
  Image,
  MessageSquare,
  Users,
  ArrowRightLeft,
  Settings,
  ScrollText,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Dashboard must not stay highlighted on every /admin/* route. */
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/posts", label: "Posts", icon: FileText },
      { href: "/admin/pages", label: "Pages", icon: Files },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/media", label: "Media", icon: Image },
      { href: "/admin/comments", label: "Comments", icon: MessageSquare },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/redirects", label: "Redirects", icon: ArrowRightLeft },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export function AdminSidebar({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean;
  /** Lets the mobile overlay close itself after a link is tapped. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
          <PenLine className="size-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Blog Admin</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.filter((s) => !s.adminOnly || isAdmin).map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
