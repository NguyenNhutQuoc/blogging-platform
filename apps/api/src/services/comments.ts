import { uuidv7 } from "uuidv7";
import { AppError } from "../lib/errors.js";
import { emailQueue } from "../jobs/queues.js";
import * as commentsRepo from "../repositories/comments.js";
import * as postsRepo from "../repositories/posts.js";
import type { EmailJobData } from "../jobs/workers/email.worker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommenterRole = "admin" | "editor" | "author" | "subscriber";

interface Actor {
  id: string;
  role: CommenterRole;
  email: string;
  name: string;
}

export interface CreateCommentInput {
  postId: string;
  content: string;
  /** ID of the comment being replied to. Max nesting: root → 1 reply level. */
  parentId?: string | null;
}

export interface ListCommentsInput {
  postId: string;
  /** Admin/editor can pass status to moderate. Public always sees "approved". */
  status?: "pending" | "approved" | "spam" | "deleted";
  page: number;
  pageSize: number;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listComments(input: ListCommentsInput) {
  const { postId, status, page, pageSize } = input;
  const { data, total } = await commentsRepo.findCommentsByPost({ postId, status, page, pageSize });
  const totalPages = Math.ceil(total / pageSize);
  return { data, meta: { page, pageSize, total, totalPages } };
}

export async function createComment(actor: Actor, input: CreateCommentInput) {
  const post = await postsRepo.findPostById(input.postId);
  if (!post) throw AppError.notFound("Post not found");

  if (post.status !== "published") {
    throw AppError.forbidden("Comments are only allowed on published posts");
  }

  // Validate parent comment if replying
  if (input.parentId) {
    const parent = await commentsRepo.findCommentById(input.parentId);
    if (!parent || parent.postId !== input.postId) {
      throw AppError.notFound("Parent comment not found");
    }
    if (parent.parentId) {
      // Only root comments (depth 0) can be replied to — replies cannot be nested further
      throw AppError.validation("Cannot reply to a reply — only top-level comments can be replied to");
    }
  }

  // Auto-approve comments from admins and editors; others go into pending queue
  const status: "approved" | "pending" =
    actor.role === "admin" || actor.role === "editor" ? "approved" : "pending";

  const comment = await commentsRepo.createComment({
    id: uuidv7(),
    postId: input.postId,
    authorId: actor.id,
    parentId: input.parentId ?? null,
    content: input.content,
    status,
  });

  // Notify post author when their post receives a new approved comment.
  // Throttled to 1 email per post per hour to prevent inbox flooding on popular posts.
  if (status === "approved" && post.authorId !== actor.id && post.author?.email) {
    const { redis } = await import("../lib/redis.js");
    const throttleKey = `comment-notif:${input.postId}`;
    const alreadySent = await redis.set(throttleKey, "1", "EX", 3600, "NX");
    if (alreadySent === "OK") {
      const excerpt = input.content.slice(0, 200) + (input.content.length > 200 ? "…" : "");
      const jobData: EmailJobData = {
        to: post.author.email,
        subject: `New comment on "${post.title}"`,
        template: "comment-notification",
        props: {
          authorName: post.author.name,
          commenterName: actor.name,
          postTitle: post.title,
          commentExcerpt: excerpt,
          commentUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/${post.slug}#comment-${comment.id}`,
        },
      };
      await emailQueue.add("comment-notification", jobData);
    }
  }

  return comment;
}

export async function updateComment(id: string, actor: Actor, content: string) {
  const comment = await commentsRepo.findCommentById(id);
  if (!comment) throw AppError.notFound("Comment not found");

  // Only the original author can edit their own comment
  if (comment.authorId !== actor.id) {
    throw AppError.forbidden("You can only edit your own comments");
  }

  return commentsRepo.updateCommentContent(id, content);
}

export async function moderateComment(
  id: string,
  actor: { role: CommenterRole },
  status: "approved" | "spam" | "deleted"
) {
  if (actor.role !== "admin" && actor.role !== "editor") {
    throw AppError.forbidden("Only admins and editors can moderate comments");
  }

  const comment = await commentsRepo.findCommentById(id);
  if (!comment) throw AppError.notFound("Comment not found");

  return commentsRepo.updateCommentStatus(id, status);
}

export async function deleteComment(id: string, actor: Actor) {
  const comment = await commentsRepo.findCommentById(id);
  if (!comment) throw AppError.notFound("Comment not found");

  const canDelete =
    comment.authorId === actor.id || actor.role === "admin" || actor.role === "editor";

  if (!canDelete) {
    throw AppError.forbidden("You can only delete your own comments");
  }

  const deleted = await commentsRepo.softDeleteComment(id);
  if (!deleted) throw AppError.notFound("Comment not found");
}
