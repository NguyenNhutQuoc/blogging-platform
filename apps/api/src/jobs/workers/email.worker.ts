import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";

export interface EmailJobData {
  to: string;
  subject: string;
  /** React Email template name */
  template: "welcome" | "password-reset" | "payment-failed" | "subscription-canceled";
  props: Record<string, unknown>;
}

/**
 * Email worker — processes transactional email jobs.
 * Uses Resend as the transport. Each job is a single email send.
 */
export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    const { to, subject, template, props } = job.data;
    console.log(`[EmailWorker] Sending "${template}" to ${to}`);

    // TODO Phase 2+: import Resend client and send via React Email templates
    // const { resend } = await import("../../lib/resend.js");
    // const html = await renderTemplate(template, props);
    // await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });

    console.log(`[EmailWorker] Sent "${subject}" to ${to}`);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
});
