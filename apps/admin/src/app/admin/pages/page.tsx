import { cookies } from "next/headers";
import { Card, CardContent, Button } from "@repo/ui";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">Static content pages (About, Privacy Policy, ToS…)</p>
        </div>
        <Button asChild>
          <a href="/admin/pages/new">New Page</a>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {pages.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No pages yet. <a href="/admin/pages/new" className="text-primary hover:underline">Create one</a>.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">Slug</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Updated</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{page.title}</td>
                    <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{page.slug}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${page.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {page.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <a href={`/admin/pages/${page.id}`} className="text-xs text-primary hover:underline">Edit</a>
                        <DeletePageButton pageId={page.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
