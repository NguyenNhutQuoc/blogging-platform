import { cookies } from "next/headers";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Button } from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";
import { AuditActionBadge } from "@/components/StatusBadge";

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

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string }>;
}) {
  const { page: pageStr, entityType } = await searchParams;
  const page = Number(pageStr ?? "1");
  const result = await fetchAuditLogs(page, entityType);

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Log" description={`${result?.meta.total ?? 0} total events`} />

      <form className="flex gap-2">
        <select
          name="entityType"
          defaultValue={entityType ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All entities</option>
          <option value="user">Users</option>
          <option value="post">Posts</option>
          <option value="page">Pages</option>
          <option value="site_settings">Settings</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>

      {!result || result.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ScrollText className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No audit events found.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {result.data.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AuditActionBadge action={log.action} />
                  <span className="text-xs text-muted-foreground">{log.entityType}</span>
                  {log.entityId && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {log.entityId.slice(0, 8)}…
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Actor: {log.actorId ? log.actorId.slice(0, 8) + "…" : "system"}</span>
                  {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                </div>
              </div>
              <time className="whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <span>
            Page {page} of {result.meta.totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${page - 1}${entityType ? `&entityType=${entityType}` : ""}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < result.meta.totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${page + 1}${entityType ? `&entityType=${entityType}` : ""}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
