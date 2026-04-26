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

interface SubscriptionCanceledEmailProps {
  name: string;
  planName: string;
  accessUntil: string;
  resubscribeUrl: string;
  siteName?: string;
}

export function SubscriptionCanceledEmail({
  name,
  planName,
  accessUntil,
  resubscribeUrl,
  siteName = "The Blog",
}: SubscriptionCanceledEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your {planName} subscription has been canceled</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Subscription Canceled</Heading>

          <Text style={styles.text}>Hi {name},</Text>
          <Text style={styles.text}>
            Your <strong>{planName}</strong> subscription on {siteName} has been
            canceled. You'll continue to have full access until{" "}
            <strong>{accessUntil}</strong>, after which your account will revert
            to the free tier.
          </Text>

          <Text style={styles.text}>
            We're sorry to see you go. If you change your mind, you can
            resubscribe at any time.
          </Text>

          <Section style={styles.btnSection}>
            <Button href={resubscribeUrl} style={styles.btn}>
              Resubscribe
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            If you canceled by mistake or have questions, please contact support
            at {siteName}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SubscriptionCanceledEmail;

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
  footer: { color: "#6b7280", fontSize: "13px", lineHeight: "1.5" },
};
