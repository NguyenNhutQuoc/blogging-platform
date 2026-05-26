import { Worker, Queue } from "bullmq";
import { redis } from "../../lib/redis.js";
import { env } from "../../lib/env.js";
import { resend } from "../../lib/resend.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import * as newsletterRepo from "../../repositories/newsletter.js";

// ─── Job payload types ────────────────────────────────────────────────────────

export type NewsletterJobData =
  | { type: "check-due" }
  | { type: "dispatch"; newsletterId: string }
  | { type: "send-batch"; newsletterId: string; subscriberIds: string[] };

// ─── Worker ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

const queue = new Queue<NewsletterJobData>(QUEUE_NAMES.NEWSLETTER, { connection: redis });

export const newsletterWorker = new Worker<NewsletterJobData>(
  QUEUE_NAMES.NEWSLETTER,
  async (job) => {
    if (job.data.type === "check-due") {
      await handleCheckDue();
    } else if (job.data.type === "dispatch") {
      await handleDispatch(job.data.newsletterId);
    } else {
      await handleBatch(job.data.newsletterId, job.data.subscriberIds);
    }
  },
  { connection: redis, concurrency: 2 }
);

newsletterWorker.on("failed", (job, err) => {
  console.error(`[NewsletterWorker] Job ${job?.id} failed:`, err.message);
});

// ─── Check due: find and dispatch scheduled newsletters ───────────────────────

async function handleCheckDue(): Promise<void> {
  const due = await newsletterRepo.findDueScheduledNewsletters();
  for (const newsletter of due) {
    console.log(`[NewsletterWorker] Dispatching scheduled newsletter "${newsletter.subject}" (${newsletter.id})`);
    await queue.add(`dispatch-${newsletter.id}`, { type: "dispatch", newsletterId: newsletter.id });
  }
}

// ─── Dispatch: fan-out into batches ───────────────────────────────────────────

async function handleDispatch(newsletterId: string): Promise<void> {
  const newsletter = await newsletterRepo.findNewsletterById(newsletterId);
  if (!newsletter) {
    console.warn(`[NewsletterWorker] Newsletter ${newsletterId} not found — skipping`);
    return;
  }
  if (newsletter.status !== "scheduled" && newsletter.status !== "sending") {
    console.warn(`[NewsletterWorker] Newsletter ${newsletterId} has status "${newsletter.status}" — skipping`);
    return;
  }

  await newsletterRepo.updateNewsletter(newsletterId, { status: "sending" });

  const total = await newsletterRepo.countActiveSubscribers();
  console.log(`[NewsletterWorker] Dispatching "${newsletter.subject}" to ${total} subscribers`);

  let offset = 0;
  while (offset < total) {
    const batch = await newsletterRepo.listActiveSubscribers(offset, BATCH_SIZE);
    if (batch.length === 0) break;

    const subscriberIds = batch.map((s) => s.id);

    // Pre-create send records so we can track status per recipient
    await newsletterRepo.bulkCreateNewsletterSends(
      subscriberIds.map((id) => ({ newsletterId, subscriberId: id, status: "pending" as const }))
    );

    await queue.add(
      `send-batch-${newsletterId}-${offset}`,
      { type: "send-batch", newsletterId, subscriberIds },
      { priority: 10 }
    );

    offset += BATCH_SIZE;
  }

  console.log(`[NewsletterWorker] Dispatch complete — ${Math.ceil(total / BATCH_SIZE)} batches queued`);
}

// ─── Send batch ───────────────────────────────────────────────────────────────

async function handleBatch(newsletterId: string, subscriberIds: string[]): Promise<void> {
  const newsletter = await newsletterRepo.findNewsletterById(newsletterId);
  if (!newsletter) return;

  const subscribers = await newsletterRepo.findSubscribersByIds(subscriberIds);
  const subMap = new Map(subscribers.map((s) => [s.id, s]));

  console.log(`[NewsletterWorker] Sending batch of ${subscribers.length} for "${newsletter.subject}"`);

  for (const subscriberId of subscriberIds) {
    const sub = subMap.get(subscriberId);
    if (!sub) continue;

    const send = await newsletterRepo.findSendByNewsletterAndSubscriber(newsletterId, subscriberId);
    if (!send || send.status !== "pending") continue;

    const unsubscribeUrl = `${env.APP_URL}/newsletter/unsubscribe?token=${sub.unsubscribeToken}`;
    const trackOpenUrl = `${env.API_URL}/api/v1/newsletter/track/open/${send.id}`;

    if (!env.RESEND_API_KEY) {
      console.log(`[NewsletterWorker] RESEND_API_KEY not set — skipping send to ${sub.email}`);
      await newsletterRepo.updateSendStatus(send.id, "sent", new Date());
      await newsletterRepo.incrementNewsletterStats(newsletterId, "statsSent");
      continue;
    }

    try {
      const html = buildNewsletterHtml(newsletter.contentHtml, {
        unsubscribeUrl,
        trackOpenUrl,
      });

      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: sub.email,
        subject: newsletter.subject,
        html,
        text: newsletter.contentText ?? stripHtml(newsletter.contentHtml),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (error) throw new Error(`Resend error: ${error.message}`);

      await newsletterRepo.updateSendStatus(send.id, "sent", new Date());
      await newsletterRepo.incrementNewsletterStats(newsletterId, "statsSent");
    } catch (err) {
      console.error(`[NewsletterWorker] Failed to send to ${sub.email}:`, err);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNewsletterHtml(
  contentHtml: string,
  opts: { unsubscribeUrl: string; trackOpenUrl: string }
): string {
  const trackPixel = `<img src="${opts.trackOpenUrl}" width="1" height="1" style="display:none" alt="" />`;
  return `${contentHtml}${trackPixel}
<p style="font-size:12px;color:#6b7280;margin-top:32px;text-align:center">
  <a href="${opts.unsubscribeUrl}" style="color:#6b7280">Unsubscribe</a>
</p>`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
