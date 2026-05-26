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

interface NewsletterConfirmEmailProps {
  name?: string;
  confirmUrl: string;
  siteName?: string;
}

export function NewsletterConfirmEmail({
  name,
  confirmUrl,
  siteName = "The Blog",
}: NewsletterConfirmEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your subscription to {siteName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Confirm your subscription</Heading>

          <Text style={styles.text}>{greeting}</Text>
          <Text style={styles.text}>
            Thanks for subscribing to {siteName}. Click the button below to
            confirm your email address and start receiving updates.
          </Text>

          <Section style={styles.btnSection}>
            <Button href={confirmUrl} style={styles.btn}>
              Confirm subscription
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            This link expires in 48 hours. If you didn't subscribe, you can
            safely ignore this email — you won't receive any further messages.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NewsletterConfirmEmail;

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
