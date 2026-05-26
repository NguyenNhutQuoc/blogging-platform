import { cookies } from "next/headers";
import { Card, CardContent, CardHeader } from "@repo/ui";

interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  newValues: unknown;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  data: AuditLog[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

async function fetchAuditLogs(page: number, entityType?: string): Promise<AuditResponse | null> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const params = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (entityType) params.set("entityType", entityType);
    const res = await fetch(`${API_URL}/api/v1/admin/audit-logs?${params}`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<AuditResponse>;
  } catch { return null; }
}

const actionColors: Record<string, string> = {
  "user.role_changed": "bg-purple-100 text-purple-700",
  "user.banned": "bg-red-100 text-red-700",
  "user.suspended": "bg-yellow-100 text-yellow-700",
  "user.restored": "bg-green-100 text-green-700",
  "user.deletion_requested": "bg-red-100 text-red-700",
  "page.created": "bg-blue-100 text-blue-700",
  "page.updated": "bg-blue-100 text-blue-700",
  "page.deleted": "bg-red-100 text-red-700",
  "settings.updated": "bg-orange-100 text-orange-700",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string }>;
}) {
  const { page: pageStr, entityType } = await searchParams;
  const page = Number(pageStr ?? "1");
  const result = await fetchAuditLogs(page, entityType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {result?.meta.total ?? 0} total events
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <form className="flex gap-2">
            <select
              name="entityType"
              defaultValue={entityType ?? ""}
              className="border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">All entities</option>
              <option value="user">Users</option>
              <option value="post">Posts</option>
              <option value="page">Pages</option>
              <option value="site_settings">Settings</option>
            </select>
            <button type="submit" className="border rounded-md px-3 py-1.5 text-sm bg-primary text-primary-foreground">
              Filter
            </button>
          </form>
        </CardHeader>
        <CardContent>
          {!result || result.data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No audit events found.</p>
          ) : (
            <div className="space-y-1">
              {result.data.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b last:border-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                        {log.action}
                      </span>
                      <span className="text-muted-foreground text-xs">{log.entityType}</span>
                      {log.entityId && <span className="text-muted-foreground text-xs font-mono">{log.entityId.slice(0, 8)}…</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Actor: {log.actorId ? log.actorId.slice(0, 8) + "…" : "system"}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          )}
          {result && result.meta.totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center text-sm">
              {page > 1 && <a href={`?page=${page - 1}${entityType ? `&entityType=${entityType}` : ""}`} className="border rounded px-3 py-1 hover:bg-muted">Previous</a>}
              <span className="px-3 py-1 text-muted-foreground">Page {page} of {result.meta.totalPages}</span>
              {page < result.meta.totalPages && <a href={`?page=${page + 1}${entityType ? `&entityType=${entityType}` : ""}`} className="border rounded px-3 py-1 hover:bg-muted">Next</a>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
