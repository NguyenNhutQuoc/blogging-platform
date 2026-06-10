import { cookies } from "next/headers";
import { Image as ImageIcon } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";

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
    const res = await fetch(`${API_URL}/api/v1/admin/media?pageSize=100`, {
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
    <div className="space-y-5">
      <PageHeader
        title="Media Library"
        description={`${media.length} file${media.length !== 1 ? "s" : ""} uploaded`}
      />

      {images.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">
            Images <span className="font-normal text-muted-foreground">({images.length})</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {images.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted transition-all hover:ring-2 hover:ring-ring"
              >
                <img
                  src={item.url}
                  alt={item.filename}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-black/0 transition-colors group-hover:bg-black/40">
                  <div className="w-full bg-gradient-to-t from-black/60 to-transparent p-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate font-medium">{item.filename}</p>
                    <p className="text-white/70">{formatBytes(item.size)}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">
            Other files <span className="font-normal text-muted-foreground">({others.length})</span>
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {others.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs hover:underline"
                    >
                      {item.filename}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.mimeType}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatBytes(item.size)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {media.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ImageIcon className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No media uploaded yet.</p>
        </div>
      )}
    </div>
  );
}
