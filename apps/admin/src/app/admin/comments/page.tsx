import { cookies } from "next/headers";
import { Card, CardContent } from "@repo/ui";
import { ModerateCommentButtons } from "./ModerateCommentButtons";

interface Comment {
  id: string;
  content: string;
  status: string;
  postId: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

async function fetchComments(status: string): Promise<{ data: Comment[]; meta: { total: number } }> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const url = `${API_URL}/api/v1/admin/comments?status=${status}&pageSize=50`;
    const res = await fetch(url, { headers: { Cookie: cookieStore.toString() }, cache: "no-store" });
    if (!res.ok) return { data: [], meta: { total: 0 } };
    return res.json() as Promise<{ data: Comment[]; meta: { total: number } }>;
  } catch { return { data: [], meta: { total: 0 } }; }
}

const STATUS_TABS = ["pending", "approved", "spam"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  spam: "Spam",
};

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = params.status ?? "pending";
  const { data: comments, meta } = await fetchComments(activeStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comment Moderation</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and moderate reader comments.</p>
      </div>

      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((s) => (
          <a
            key={s}
            href={`/admin/comments?status=${s}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeStatus === s
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </a>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-4">{meta.total} comment{meta.total !== 1 ? "s" : ""}</p>
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No {STATUS_LABELS[activeStatus]?.toLowerCase()} comments.</p>
          ) : (
            <ul className="divide-y">
              {comments.map((comment) => (
                <li key={comment.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{comment.author?.name ?? "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          comment.status === "pending" ? "bg-yellow-100 text-yellow-700"
                            : comment.status === "approved" ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {comment.status}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed line-clamp-3">{comment.content}</p>
                    </div>
                    <ModerateCommentButtons commentId={comment.id} currentStatus={comment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
