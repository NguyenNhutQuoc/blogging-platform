"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui";
import { config } from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Comment {
  id: string;
  postId: string;
  parentId?: string | null;
  content: string;
  status: string;
  author?: CommentAuthor | null;
  guestName?: string | null;
  createdAt: string;
}

interface Session {
  user: { id: string; name: string; email: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { apiUrl: API_URL, adminUrl: ADMIN_URL } = config;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: Comment;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  const displayName = comment.author?.name ?? comment.guestName ?? "Anonymous";
  const initials = getInitials(displayName);

  return (
    <div className={`flex gap-3 ${depth > 0 ? "ml-8 mt-3" : "mt-4"}`}>
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        {comment.author?.avatarUrl && (
          <AvatarImage src={comment.author.avatarUrl} alt={displayName} />
        )}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{displayName}</span>
          {!comment.author && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Guest</span>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-sm mt-1 text-foreground leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>
        {depth === 0 && (
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  session,
  onSuccess,
  onCancel,
}: {
  postId: string;
  parentId?: string | null;
  session: Session;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim(), parentId: parentId ?? undefined }),
      });
      const data = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!data.success) throw new Error(data.error?.message ?? "Failed to submit comment");
      setContent("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs">{getInitials(session.user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={parentId ? "Write a reply…" : "Write a comment…"}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            disabled={loading}
          />
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Posting…" : "Post"}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  async function loadComments(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`, {
        credentials: "include",
      });
      if (!res.ok) { setFetchError(true); return; }
      const data = (await res.json()) as { success: boolean; data?: Comment[] };
      if (data.success && data.data) {
        setComments(data.data);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
  }

  useEffect(() => {
    async function init() {
      // Fetch comments and session in parallel — setLoading(false) always runs
      const [, sessionRes] = await Promise.allSettled([
        loadComments(),
        fetch(`${API_URL}/api/v1/auth/session`, { credentials: "include" })
          .then((r) => r.json() as Promise<{ data?: { user: Session["user"] } }>)
          .catch(() => null),
      ]);

      if (sessionRes.status === "fulfilled" && sessionRes.value?.data?.user) {
        setSession({ user: sessionRes.value.data.user });
      }
      setLoading(false);
    }
    init();
  }, [postId]);

  // Build flat list into root + replies map
  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
  }

  function handleCommentSuccess() {
    setReplyingTo(null);
    loadComments();
  }

  return (
    <section className="mt-12 pt-8 border-t">
      <h2 className="text-xl font-semibold mb-2">
        Comments {comments.length > 0 && <span className="text-muted-foreground font-normal text-base">({comments.length})</span>}
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : fetchError ? (
        <p className="text-sm text-muted-foreground mt-2">
          Could not load comments.{" "}
          <button
            onClick={() => { setFetchError(false); loadComments(); }}
            className="underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          {/* Top-level comment form */}
          {session ? (
            <CommentForm
              postId={postId}
              session={session}
              onSuccess={handleCommentSuccess}
            />
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              <a
                href={`${ADMIN_URL}/sign-in`}
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Sign in
              </a>{" "}
              to leave a comment.
            </p>
          )}

          {/* Comment list */}
          <div className="mt-6 space-y-6 divide-y">
            {roots.length === 0 ? (
              <p className="text-sm text-muted-foreground pt-4">No comments yet. Be the first!</p>
            ) : (
              roots.map((root) => (
                <div key={root.id} className="pt-4 first:pt-0">
                  <CommentItem
                    comment={root}
                    depth={0}
                    onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
                  />

                  {/* Replies */}
                  {(repliesByParent.get(root.id) ?? []).map((reply) => (
                    <CommentItem key={reply.id} comment={reply} depth={1} onReply={() => {}} />
                  ))}

                  {/* Reply form */}
                  {replyingTo === root.id && session && (
                    <div className="ml-8 mt-2">
                      <CommentForm
                        postId={postId}
                        parentId={root.id}
                        session={session}
                        onSuccess={handleCommentSuccess}
                        onCancel={() => setReplyingTo(null)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
