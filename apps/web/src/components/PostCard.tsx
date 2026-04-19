import { Card, CardContent, CardHeader, Badge } from "@repo/ui";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    publishedAt?: string | null;
    readingTimeMinutes?: number | null;
    author: { id: string; name: string; avatarUrl?: string | null };
    categories?: { id: string; name: string; slug: string }[];
    tags?: { id: string; name: string; slug: string }[];
  };
}

export function PostCard({ post }: PostCardProps) {
  return (
    <a href={`/${post.slug}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        {post.coverImageUrl && (
          <div className="aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        <CardHeader className="pb-2">
          {(post.categories?.length ?? 0) > 0 && (
            <div className="flex gap-1 mb-2">
              {post.categories!.slice(0, 2).map((cat) => (
                <Badge key={cat.id} variant="secondary" className="text-xs">
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}
          <h2 className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h2>
        </CardHeader>

        <CardContent>
          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">{post.author.name}</span>
            <div className="flex items-center gap-2">
              {post.publishedAt && (
                <span>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              {post.readingTimeMinutes && (
                <>
                  <span>·</span>
                  <span>{post.readingTimeMinutes}m read</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
