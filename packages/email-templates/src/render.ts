import { render as reactEmailRender } from "@react-email/components";
import type { ReactElement } from "react";

/**
 * Converts a React Email component tree into HTML + plain-text strings
 * ready to pass directly to Resend (or any email provider).
 *
 * Usage:
 *   const { html, text } = await renderEmail(<WelcomeEmail name="Alice" ... />);
 *   await resend.emails.send({ html, text, ... });
 */
export async function renderEmail(element: ReactElement): Promise<{
  html: string;
  text: string;
}> {
  const [html, text] = await Promise.all([
    reactEmailRender(element, { pretty: false }),
    reactEmailRender(element, { plainText: true }),
  ]);

  return { html, text };
}
