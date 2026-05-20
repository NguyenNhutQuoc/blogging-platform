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

interface PaymentFailedEmailProps {
  name: string;
  planName: string;
  amountFormatted: string;
  updatePaymentUrl: string;
  siteName?: string;
}

export function PaymentFailedEmail({
  name,
  planName,
  amountFormatted,
  updatePaymentUrl,
  siteName = "The Blog",
}: PaymentFailedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Action needed: Payment failed for your {planName} subscription</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.alertBanner}>
            <Text style={styles.alertText}>Payment Failed</Text>
          </Section>

          <Heading style={styles.heading}>We couldn't process your payment</Heading>

          <Text style={styles.text}>Hi {name},</Text>
          <Text style={styles.text}>
            A payment of <strong>{amountFormatted}</strong> for your{" "}
            <strong>{planName}</strong> subscription on {siteName} was declined.
            To keep your access, please update your payment method.
          </Text>

          <Section style={styles.btnSection}>
            <Button href={updatePaymentUrl} style={styles.btn}>
              Update Payment Method
            </Button>
          </Section>

          <Text style={styles.text}>
            If you don't update your payment method soon, your subscription will
            be paused and you'll lose access to premium content.
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            If you believe this is an error, please contact support at {siteName}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PaymentFailedEmail;

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
  alertBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    padding: "12px 16px",
    marginBottom: "24px",
  },
  alertText: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: "700",
    margin: "0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  heading: {
    color: "#111827",
    fontSize: "22px",
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
    backgroundColor: "#dc2626",
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
