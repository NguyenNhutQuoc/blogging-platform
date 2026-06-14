import { cookies } from "next/headers";
import Link from "next/link";
import { Files } from "lucide-react";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DeletePageButton } from "./DeletePageButton";

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
}

async function fetchPages(): Promise<Page[]> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const res = await fetch(`${API_URL}/api/v1/admin/pages`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = await res.json() as { data: Page[] };
    return body.data;
  } catch { return []; }
}

export default async function PagesPage() {
  const pages = await fetchPages();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pages"
        description="Static content pages (About, Privacy Policy, ToS…)"
        actions={
          <Button asChild size="sm">
            <Link href="/admin/pages/new">New page</Link>
          </Button>
        }
      />

      {pages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Files className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No pages yet.</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/admin/pages/new">Create one</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-medium">{page.title}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{page.slug}</TableCell>
                <TableCell>
                  <StatusBadge status={page.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/pages/${page.id}`}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </Link>
                    <DeletePageButton pageId={page.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
