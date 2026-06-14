import Link from "next/link";
import { cn } from "@repo/ui";

/**
 * URL-driven filter tabs (underline style). Filters on admin list pages are
 * searchParams-based links, so no client state is needed.
 */
export function LinkTabs({
  tabs,
}: {
  tabs: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            tab.active
              ? "border-foreground font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
