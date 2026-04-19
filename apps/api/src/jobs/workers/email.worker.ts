import { Worker } from "bullmq";
import * as React from "react";
import { redis } from "../../lib/redis.js";
import { env } from "../../lib/env.js";
import { resend } from "../../lib/resend.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import {
  WelcomeEmail,
  PasswordResetEmail,
  CommentNotificationEmail,
  renderEmail,
} from "@repo/email-templates";

// ─── Job payload types ────────────────────────────────────────────────────────

interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
  siteName?: string;
}

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresInHours?: number;
  siteName?: string;
}

interface CommentNotificationEmailProps {
  authorName: string;
  commenterName: string;
  postTitle: string;
  commentExcerpt: string;
  commentUrl: string;
  siteName?: string;
}

export type EmailJobData =
  | {
      to: string;
      subject: string;
      template: "welcome";
      props: WelcomeEmailProps;
    }
  | {
      to: string;
      subject: string;
      template: "password-reset";
      props: PasswordResetEmailProps;
    }
  | {
      to: string;
      subject: string;
      template: "comment-notification";
      props: CommentNotificationEmailProps;
    };

// ─── Template renderer ────────────────────────────────────────────────────────

/**
 * Builds the React Email element for each template type and renders it
 * to HTML + plain-text strings via @react-email/components.
 */
async function buildEmail(
  data: EmailJobData,
): Promise<{ html: string; text: string }> {
  switch (data.template) {
    case "welcome":
      return renderEmail(React.createElement(WelcomeEmail, data.props));
    case "password-reset":
      return renderEmail(React.createElement(PasswordResetEmail, data.props));
    case "comment-notification":
      return renderEmail(
        React.createElement(CommentNotificationEmail, data.props),
      );
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
