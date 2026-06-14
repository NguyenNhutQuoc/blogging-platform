import { cookies } from "next/headers";
import { ArrowRightLeft } from "lucide-react";
import {
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DeleteRedirectButton } from "./DeleteRedirectButton";
import { RedirectForm } from "./RedirectForm";

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  createdAt: string;
}

async function fetchRedirects(): Promise<Redirect[]> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const res = await fetch(`${API_URL}/api/v1/admin/redirects`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = await res.json() as { data: Redirect[] };
    return body.data;
  } catch { return []; }
}

export default async function RedirectsPage() {
  const redirects = await fetchRedirects();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Redirects"
        description="Manage URL redirects (301/302), handled at the API layer"
      />

      <RedirectForm />

      {redirects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ArrowRightLeft className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No redirects configured.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {redirects.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.fromPath}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.toPath}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {r.statusCode}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.isActive ? "active" : "inactive"} />
                </TableCell>
                <TableCell>
                  <DeleteRedirectButton redirectId={r.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
