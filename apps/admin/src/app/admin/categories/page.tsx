import { cookies } from "next/headers";
import Link from "next/link";
import { Badge, Button } from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount?: number;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
}

async function fetchAll(): Promise<{ categories: Category[]; tags: Tag[] }> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const headers = { Cookie: cookieStore.toString() };

    const [catRes, tagRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/categories`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/api/v1/tags`, { headers, cache: "no-store" }),
    ]);

    const categories = catRes.ok ? ((await catRes.json() as { data: Category[] }).data) : [];
    const tags = tagRes.ok ? ((await tagRes.json() as { data: Tag[] }).data) : [];
    return { categories, tags };
  } catch { return { categories: [], tags: [] }; }
}

export default async function CategoriesPage() {
  const { categories, tags } = await fetchAll();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories & Tags"
        description="Manage taxonomy for organising posts"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Categories */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-medium">
              Categories{" "}
              <span className="font-normal text-muted-foreground">({categories.length})</span>
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/categories/new">New category</Link>
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="divide-y">
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{cat.slug}</span>
                    {cat.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
                    )}
                  </div>
                  <Link
                    href={`/admin/categories/${cat.id}`}
                    className="ml-4 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tags */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-medium">
              Tags <span className="font-normal text-muted-foreground">({tags.length})</span>
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/categories/new-tag">New tag</Link>
            </Button>
          </div>
          {tags.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 p-4">
              {tags.map((tag) => (
                <Link key={tag.id} href={`/admin/categories/tag/${tag.id}`}>
                  <Badge variant="secondary" className="hover:bg-accent">
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
