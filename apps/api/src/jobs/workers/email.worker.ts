import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { env } from "../../lib/env.js";
import { resend } from "../../lib/resend.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import {
  renderWelcomeEmail,
  renderPasswordResetEmail,
  renderCommentNotificationEmail,
  type WelcomeEmailProps,
  type PasswordResetEmailProps,
  type CommentNotificationEmailProps,
} from "@repo/email-templates";

// ─── Job payload types ────────────────────────────────────────────────────────

export type EmailJobData =
  | { to: string; subject: string; template: "welcome"; props: WelcomeEmailProps }
  | { to: string; subject: string; template: "password-reset"; props: PasswordResetEmailProps }
  | { to: string; subject: string; template: "comment-notification"; props: CommentNotificationEmailProps };

// ─── Template renderer ────────────────────────────────────────────────────────

/**
 * Delegates rendering to @repo/email-templates, which owns React as a dep.
 * The API worker never imports React directly — keeps the backend React-free.
 */
async function buildEmail(data: EmailJobData): Promise<{ html: string; text: string }> {
  switch (data.template) {
    case "welcome":
      return renderWelcomeEmail(data.props);
    case "password-reset":
      return renderPasswordResetEmail(data.props);
    case "comment-notification":
      return renderCommentNotificationEmail(data.props);
  }
}

// ─── Worker ──────────────────────────────────────────────────────────────────

/**
 * Email worker — processes transactional email jobs via Resend.
 *
 * When RESEND_API_KEY is empty (local dev without an API key), the worker
 * renders the template and logs the HTML to stdout instead of sending —
 * no deliveries fail silently, no surprises in production.
 */
export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    const { to, subject } = job.data;
    console.log(`[EmailWorker] Rendering "${job.data.template}" for ${to}`);

    const { html, text } = await buildEmail(job.data);

    if (!env.RESEND_API_KEY) {
      // Dev fallback: log the rendered output so developers can inspect
      // templates without needing a Resend account.
      console.log(`[EmailWorker] RESEND_API_KEY not set — skipping send`);
      console.log(`  To:      ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Text:    ${text.slice(0, 200)}...`);
      return;
    }

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`[EmailWorker] Delivered "${subject}" to ${to}`);
  },
  { connection: redis, concurrency: 5 },
);

emailWorker.on("failed", (job, err) => {
  console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
});
