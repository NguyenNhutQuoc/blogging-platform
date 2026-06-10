import { cookies } from "next/headers";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LinkTabs } from "@/components/LinkTabs";
import { StatusBadge } from "@/components/StatusBadge";
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
    <div className="space-y-5">
      <PageHeader
        title="Comments"
        description={`Review and moderate reader comments — ${meta.total} ${STATUS_LABELS[activeStatus]?.toLowerCase()}`}
      />

      <LinkTabs
        tabs={STATUS_TABS.map((s) => ({
          label: STATUS_LABELS[s] ?? s,
          href: `/admin/comments?status=${s}`,
          active: activeStatus === s,
        }))}
      />

      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <MessageSquare className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            No {STATUS_LABELS[activeStatus]?.toLowerCase()} comments.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {comments.map((comment) => (
            <li key={comment.id} className="p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.author?.name ?? "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                    <StatusBadge status={comment.status} />
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-foreground">{comment.content}</p>
                </div>
                <ModerateCommentButtons commentId={comment.id} currentStatus={comment.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
