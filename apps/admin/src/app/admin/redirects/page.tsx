import { cookies } from "next/headers";
import { Card, CardContent } from "@repo/ui";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Redirects</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage URL redirects (301/302). Handled at the API layer.</p>
      </div>

      <RedirectForm />

      <Card>
        <CardContent className="pt-4">
          {redirects.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No redirects configured.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">From</th>
                  <th className="pb-2 pr-4 font-medium">To</th>
                  <th className="pb-2 pr-4 font-medium">Code</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono text-xs">{r.fromPath}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{r.toPath}</td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono">{r.statusCode}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="py-3">
                      <DeleteRedirectButton redirectId={r.id} />
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
