import * as React from "react";
import { WelcomeEmail } from "./templates/WelcomeEmail.js";
import { PasswordResetEmail } from "./templates/PasswordResetEmail.js";
import { CommentNotificationEmail } from "./templates/CommentNotificationEmail.js";
import { SubscriptionActivatedEmail } from "./templates/SubscriptionActivatedEmail.js";
import { PaymentFailedEmail } from "./templates/PaymentFailedEmail.js";
import { SubscriptionCanceledEmail } from "./templates/SubscriptionCanceledEmail.js";
import { renderEmail } from "./render.js";

export { WelcomeEmail } from "./templates/WelcomeEmail.js";
export { PasswordResetEmail } from "./templates/PasswordResetEmail.js";
export { CommentNotificationEmail } from "./templates/CommentNotificationEmail.js";
export { SubscriptionActivatedEmail } from "./templates/SubscriptionActivatedEmail.js";
export { PaymentFailedEmail } from "./templates/PaymentFailedEmail.js";
export { SubscriptionCanceledEmail } from "./templates/SubscriptionCanceledEmail.js";
export { renderEmail } from "./render.js";

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
  siteName?: string;
}

export interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresInHours?: number;
  siteName?: string;
}

export interface CommentNotificationEmailProps {
  authorName: string;
  commenterName: string;
  postTitle: string;
  commentExcerpt: string;
  commentUrl: string;
  siteName?: string;
}

export interface SubscriptionActivatedEmailProps {
  name: string;
  planName: string;
  planFeatures: string[];
  renewalDate: string;
  manageUrl: string;
  siteName?: string;
}

export interface PaymentFailedEmailProps {
  name: string;
  planName: string;
  amountFormatted: string;
  updatePaymentUrl: string;
  siteName?: string;
}

export interface SubscriptionCanceledEmailProps {
  name: string;
  planName: string;
  accessUntil: string;
  resubscribeUrl: string;
  siteName?: string;
}

// ─── Render functions ─────────────────────────────────────────────────────────

export function renderWelcomeEmail(props: WelcomeEmailProps) {
  return renderEmail(React.createElement(WelcomeEmail, props));
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps) {
  return renderEmail(React.createElement(PasswordResetEmail, props));
}

export function renderCommentNotificationEmail(props: CommentNotificationEmailProps) {
  return renderEmail(React.createElement(CommentNotificationEmail, props));
}

export function renderSubscriptionActivatedEmail(props: SubscriptionActivatedEmailProps) {
  return renderEmail(React.createElement(SubscriptionActivatedEmail, props));
}

export function renderPaymentFailedEmail(props: PaymentFailedEmailProps) {
  return renderEmail(React.createElement(PaymentFailedEmail, props));
}

export function renderSubscriptionCanceledEmail(props: SubscriptionCanceledEmailProps) {
  return renderEmail(React.createElement(SubscriptionCanceledEmail, props));
}
