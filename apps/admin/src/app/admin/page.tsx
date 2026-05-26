import { cookies } from "next/headers";
import { Card, CardContent, CardHeader } from "@repo/ui";

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

export default async function AdminDashboardPage() {
  const stats = await fetchStats();

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—" },
    { label: "Realtime Visitors", value: stats?.realtimeVisitors ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your blog platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Quick Links</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <a href="/admin/posts/new" className="flex items-center gap-2 text-primary hover:underline">New Post</a>
            <a href="/admin/users" className="flex items-center gap-2 text-primary hover:underline">Manage Users</a>
            <a href="/admin/pages" className="flex items-center gap-2 text-primary hover:underline">Manage Pages</a>
            <a href="/admin/settings" className="flex items-center gap-2 text-primary hover:underline">Site Settings</a>
            <a href="/admin/audit-logs" className="flex items-center gap-2 text-primary hover:underline">Audit Log</a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
