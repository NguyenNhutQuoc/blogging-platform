import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronRight, FilePlus2, Users, Files, Settings, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface StatsData {
  totalUsers: number;
  totalPosts: number;
  totalSubscribers: number;
  realtimeVisitors: number;
}

async function fetchStats(): Promise<StatsData | null> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const [usersRes, overviewRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/admin/users?pageSize=1`, {
        headers: { Cookie: cookieStore.toString() },
        cache: "no-store",
      }),
      fetch(`${API_URL}/api/v1/admin/analytics/overview`, {
        headers: { Cookie: cookieStore.toString() },
        cache: "no-store",
      }),
    ]);
    const users = usersRes.ok ? (await usersRes.json() as { meta: { total: number } }) : null;
    const overview = overviewRes.ok ? (await overviewRes.json() as { data: { totalViews: number; realtimeVisitors: number } }) : null;
    return {
      totalUsers: users?.meta.total ?? 0,
      totalPosts: 0,
      totalSubscribers: 0,
      realtimeVisitors: overview?.data.realtimeVisitors ?? 0,
    };
  } catch {
    return null;
  }
}

const quickLinks = [
  { href: "/admin/posts/new", label: "New Post", icon: FilePlus2 },
  { href: "/admin/users", label: "Manage Users", icon: Users },
  { href: "/admin/pages", label: "Manage Pages", icon: Files },
  { href: "/admin/settings", label: "Site Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
];

export default async function AdminDashboardPage() {
  const stats = await fetchStats();

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—" },
    { label: "Realtime Visitors", value: stats?.realtimeVisitors ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your blog platform" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border p-4">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border">
          <p className="border-b px-4 py-3 text-sm font-medium">Quick Links</p>
          <div className="divide-y">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <span className="flex items-center gap-2.5">
                  <link.icon className="size-4" />
                  {link.label}
                </span>
                <ChevronRight className="size-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
