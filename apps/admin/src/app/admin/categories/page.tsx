import { cookies } from "next/headers";
import { Card, CardContent, Button } from "@repo/ui";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories &amp; Tags</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage taxonomy for organising posts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Categories <span className="text-muted-foreground font-normal text-sm">({categories.length})</span></h2>
              <Button asChild size="sm">
                <a href="/admin/categories/new">New category</a>
              </Button>
            </div>
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No categories yet.</p>
            ) : (
              <ul className="divide-y">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="font-medium text-sm">{cat.name}</span>
                      <span className="text-muted-foreground text-xs ml-2 font-mono">{cat.slug}</span>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                    <a href={`/admin/categories/${cat.id}`} className="text-xs text-primary hover:underline ml-4 shrink-0">Edit</a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Tags <span className="text-muted-foreground font-normal text-sm">({tags.length})</span></h2>
              <Button asChild size="sm">
                <a href="/admin/categories/new-tag">New tag</a>
              </Button>
            </div>
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/admin/categories/tag/${tag.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs hover:bg-accent transition-colors"
                  >
                    {tag.name}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
