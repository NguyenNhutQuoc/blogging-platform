import { Avatar, AvatarFallback, AvatarImage, Separator } from "@repo/ui";

interface AuthorCardProps {
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export function AuthorCard({ author }: AuthorCardProps) {
  const initials = author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-lg border p-6">
      <Separator className="mb-6" />
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={author.name} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Written by</p>
          <p className="font-semibold">{author.name}</p>
        </div>
      </div>
    </div>
  );
}
