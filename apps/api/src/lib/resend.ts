import { Resend } from "resend";
import { env } from "./env.js";

/**
 * Shared Resend client — lazily instantiated to avoid crashing on startup
 * when RESEND_API_KEY is empty (e.g. in test environments or local dev
 * without a real API key).
 *
 * In dev with no key, the email worker logs the rendered HTML to stdout
 * instead of sending. Set RESEND_API_KEY in .env to enable actual delivery.
 */
export const resend = new Resend(env.RESEND_API_KEY || "re_placeholder");
