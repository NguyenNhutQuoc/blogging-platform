import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageEditForm } from "./PageEditForm";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

async function fetchPage(id: string): Promise<Page | null> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const res = await fetch(`${API_URL}/api/v1/admin/pages`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json() as { data: Page[] };
    return body.data.find((p) => p.id === id) ?? null;
  } catch { return null; }
}

export default async function PageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await fetchPage(id);
  if (!page) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Edit Page</h1>
      <PageEditForm page={page} />
    </div>
  );
}
