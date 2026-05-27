import { cookies } from "next/headers";
import { Card, CardContent } from "@repo/ui";

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

async function fetchMedia(): Promise<MediaItem[]> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const res = await fetch(`${API_URL}/api/v1/media?pageSize=100`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = await res.json() as { data: MediaItem[] };
    return body.data;
  } catch { return []; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaPage() {
  const media = await fetchMedia();
  const images = media.filter((m) => m.mimeType.startsWith("image/"));
  const others = media.filter((m) => !m.mimeType.startsWith("image/"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-muted-foreground text-sm mt-1">{media.length} file{media.length !== 1 ? "s" : ""} uploaded</p>
        </div>
      </div>

      {images.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-3">Images ({images.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {images.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all"
                >
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                    <div className="w-full p-1.5 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                      <p className="truncate font-medium">{item.filename}</p>
                      <p className="text-white/70">{formatBytes(item.size)}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {others.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-3">Other files ({others.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Filename</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Size</th>
                  <th className="pb-2 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {others.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">
                        {item.filename}
                      </a>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{item.mimeType}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{formatBytes(item.size)}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {media.length === 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm py-8 text-center">No media uploaded yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
