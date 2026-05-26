import crypto from "crypto";
import { emailQueue, newsletterQueue } from "../jobs/queues.js";
import { AppError } from "../lib/errors.js";
import { env } from "../lib/env.js";
import * as repo from "../repositories/newsletter.js";
import type {
  CreateNewsletterInput,
  UpdateNewsletterInput,
  ScheduleNewsletterInput,
  ListSubscribersInput,
  ListNewslettersInput,
} from "@repo/validators/newsletter";
import type { Newsletter, NewsletterSubscriber, NewsletterSend } from "@repo/database";

// ─── Subscribers ──────────────────────────────────────────────────────────────

export async function subscribe(
  email: string,
  name?: string
): Promise<{ subscriber: NewsletterSubscriber; isNew: boolean }> {
  const existing = await repo.findSubscriberByEmail(email);

  if (existing) {
    // Already confirmed and active — no-op
    if (existing.status === "active" && !existing.confirmToken) {
      return { subscriber: existing, isNew: false };
    }
    // Re-subscribe or re-send confirmation
    const confirmToken = crypto.randomBytes(32).toString("hex");
    const updated = await repo.updateSubscriber(existing.id, {
      status: "active",
      name: name ?? existing.name,
      confirmToken,
    });
    await sendConfirmEmail(email, name ?? existing.name ?? undefined, confirmToken);
    return { subscriber: updated!, isNew: false };
  }

  const confirmToken = crypto.randomBytes(32).toString("hex");
  const unsubscribeToken = crypto.randomBytes(32).toString("hex");

  // Status is "active" but confirmToken is set — means unconfirmed.
  // listActiveSubscribers filters out rows where confirmToken IS NOT NULL.
  const subscriber = await repo.createSubscriber({
    email: email.toLowerCase(),
    name: name ?? null,
    status: "active",
    confirmToken,
    unsubscribeToken,
  });

  await sendConfirmEmail(email, name, confirmToken);
  return { subscriber, isNew: true };
}

export async function confirmSubscription(
  token: string
): Promise<NewsletterSubscriber> {
  const subscriber = await repo.findSubscriberByToken(token, "confirm");
  if (!subscriber) throw AppError.notFound("Invalid or expired confirmation token");

  const updated = await repo.updateSubscriber(subscriber.id, {
    status: "active",
    confirmToken: null,
  });
  return updated!;
}

export async function unsubscribe(token: string): Promise<void> {
  const subscriber = await repo.findSubscriberByToken(token, "unsubscribe");
  if (!subscriber) throw AppError.notFound("Invalid unsubscribe token");

  await repo.updateSubscriber(subscriber.id, { status: "unsubscribed" });
}

export async function listSubscribers(
  filter: ListSubscribersInput
): Promise<{ data: NewsletterSubscriber[]; total: number }> {
  return repo.listSubscribers(filter);
}

// ─── Newsletters ──────────────────────────────────────────────────────────────

export async function createNewsletter(
  data: CreateNewsletterInput,
  authorId: string
): Promise<Newsletter> {
  return repo.createNewsletter({ ...data, authorId, status: "draft" });
}

export async function updateNewsletter(
  id: string,
  data: UpdateNewsletterInput
): Promise<Newsletter> {
  const newsletter = await repo.findNewsletterById(id);
  if (!newsletter) throw AppError.notFound("Newsletter not found");
  if (newsletter.status === "sent") {
    throw new AppError("FORBIDDEN", "Cannot edit a newsletter that has already been sent", 403);
  }

  const updated = await repo.updateNewsletter(id, data);
  return updated!;
}

export async function scheduleNewsletter(
  id: string,
  input: ScheduleNewsletterInput
): Promise<Newsletter> {
  const newsletter = await repo.findNewsletterById(id);
  if (!newsletter) throw AppError.notFound("Newsletter not found");
  if (newsletter.status === "sent" || newsletter.status === "sending") {
    throw new AppError("FORBIDDEN", "Newsletter is already being sent or sent", 403);
  }

  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt <= new Date()) {
    throw new AppError("VALIDATION_ERROR", "scheduledAt must be in the future", 400);
  }

  const updated = await repo.updateNewsletter(id, { status: "scheduled", scheduledAt });
  return updated!;
}

export async function sendNewsletterNow(id: string): Promise<Newsletter> {
  const newsletter = await repo.findNewsletterById(id);
  if (!newsletter) throw AppError.notFound("Newsletter not found");
  if (newsletter.status === "sent" || newsletter.status === "sending") {
    throw new AppError("FORBIDDEN", "Newsletter is already being sent or sent", 403);
  }

  await newsletterQueue.add(`dispatch-${id}`, { type: "dispatch", newsletterId: id });
  const updated = await repo.updateNewsletter(id, { status: "sending" });
  return updated!;
}

export async function getNewsletter(id: string): Promise<Newsletter> {
  const newsletter = await repo.findNewsletterById(id);
  if (!newsletter) throw AppError.notFound("Newsletter not found");
  return newsletter;
}

export async function listNewsletters(
  filter: ListNewslettersInput
): Promise<{ data: Newsletter[]; total: number }> {
  return repo.listNewsletters(filter);
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export async function trackOpen(sendId: string): Promise<void> {
  const send = await repo.findSendById(sendId);
  if (!send) return;

  await repo.markSendOpened(sendId);
  await repo.incrementNewsletterStats(send.newsletterId, "statsOpened");
}

export async function trackClick(sendId: string): Promise<void> {
  const send = await repo.findSendById(sendId);
  if (!send) return;

  await repo.markSendClicked(sendId);
  await repo.incrementNewsletterStats(send.newsletterId, "statsClicked");
}

// ─── Webhook: handle Resend bounce/complaint events ──────────────────────────

export async function handleEmailEvent(
  subscriberEmail: string,
  event: "bounced" | "complained"
): Promise<void> {
  const subscriber = await repo.findSubscriberByEmail(subscriberEmail);
  if (!subscriber) return;

  await repo.updateSubscriber(subscriber.id, {
    status: event === "bounced" ? "bounced" : "complained",
  });
}

// ─── Cron: dispatch due scheduled newsletters ─────────────────────────────────

export async function dispatchDueNewsletters(): Promise<void> {
  const due = await repo.findDueScheduledNewsletters();
  for (const newsletter of due) {
    console.log(`[NewsletterCron] Dispatching scheduled newsletter "${newsletter.subject}" (${newsletter.id})`);
    await newsletterQueue.add(`dispatch-${newsletter.id}`, {
      type: "dispatch",
      newsletterId: newsletter.id,
    });
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function sendConfirmEmail(
  email: string,
  name: string | undefined,
  token: string
): Promise<void> {
  const confirmUrl = `${env.APP_URL}/newsletter/confirm?token=${token}`;
  await emailQueue.add(`newsletter-confirm-${email}`, {
    to: email,
    subject: "Confirm your newsletter subscription",
    template: "newsletter-confirm",
    props: { name, confirmUrl },
  });
}
