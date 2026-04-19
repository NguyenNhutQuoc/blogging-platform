import * as React from "react";
import { WelcomeEmail } from "./templates/WelcomeEmail.js";
import { PasswordResetEmail } from "./templates/PasswordResetEmail.js";
import { CommentNotificationEmail } from "./templates/CommentNotificationEmail.js";
import { renderEmail } from "./render.js";

export { WelcomeEmail } from "./templates/WelcomeEmail.js";
export { PasswordResetEmail } from "./templates/PasswordResetEmail.js";
export { CommentNotificationEmail } from "./templates/CommentNotificationEmail.js";
export { renderEmail } from "./render.js";

// ─── Prop types (re-exported so callers don't need to import React) ───────────

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

// ─── Convenience render functions ─────────────────────────────────────────────
//
// These wrap React.createElement so callers (e.g. the email worker in apps/api)
// never need to import React themselves. React is a dependency of this package,
// not of the API — keeping the backend React-free.

export function renderWelcomeEmail(props: WelcomeEmailProps) {
  return renderEmail(React.createElement(WelcomeEmail, props));
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps) {
  return renderEmail(React.createElement(PasswordResetEmail, props));
}

export function renderCommentNotificationEmail(props: CommentNotificationEmailProps) {
  return renderEmail(React.createElement(CommentNotificationEmail, props));
}
