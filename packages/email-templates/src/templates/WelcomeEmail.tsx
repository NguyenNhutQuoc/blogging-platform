import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  name: string;
  /** URL to the user's new account dashboard / feed */
  loginUrl: string;
  /** Site name shown in the email header */
  siteName?: string;
}

/**
 * Welcome email sent when a user first creates an account.
 * Keeps it short — one clear CTA to get them into the product.
 */
export function WelcomeEmail({
  name,
  loginUrl,
  siteName = "The Blog",
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to {siteName} — you're all set!</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Welcome to {siteName} 👋</Heading>

          <Text style={styles.text}>Hi {name},</Text>
          <Text style={styles.text}>
            Your account is ready. Start reading, or if you're an author, head
            to the editor and publish your first post.
          </Text>

          <Section style={styles.btnSection}>
            <Button href={loginUrl} style={styles.btn}>
              Go to {siteName}
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            You're receiving this because you created an account on {siteName}.
            If this wasn't you, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

// ─── Inline styles (React Email renders to plain HTML — no Tailwind) ──────────

const styles = {
  body: {
    backgroundColor: "#f4f4f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "40px auto",
    padding: "32px 40px",
    maxWidth: "560px",
  },
  heading: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 24px",
  },
  text: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  btnSection: { textAlign: "center" as const, margin: "32px 0" },
  btn: {
    backgroundColor: "#7c3aed",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    padding: "12px 28px",
    textDecoration: "none",
  },
  hr: { borderColor: "#e5e7eb", margin: "24px 0" },
  footer: {
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: "1.5",
  },
};
