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

interface SubscriptionActivatedEmailProps {
  name: string;
  planName: string;
  planFeatures: string[];
  renewalDate: string;
  manageUrl: string;
  siteName?: string;
}

export function SubscriptionActivatedEmail({
  name,
  planName,
  planFeatures,
  renewalDate,
  manageUrl,
  siteName = "The Blog",
}: SubscriptionActivatedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your {planName} subscription is now active!</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Subscription Activated</Heading>

          <Text style={styles.text}>Hi {name},</Text>
          <Text style={styles.text}>
            Your <strong>{planName}</strong> subscription on {siteName} is now
            active. Here's what you get:
          </Text>

          <Section style={styles.featureList}>
            {planFeatures.map((feature, i) => (
              <Text key={i} style={styles.featureItem}>
                ✓ {feature}
              </Text>
            ))}
          </Section>

          <Text style={styles.text}>
            Your subscription will automatically renew on{" "}
            <strong>{renewalDate}</strong>. You can manage or cancel anytime
            from your account settings.
          </Text>

          <Section style={styles.btnSection}>
            <Button href={manageUrl} style={styles.btn}>
              Manage Subscription
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            Questions? Reply to this email or visit {siteName} support.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SubscriptionActivatedEmail;

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
  featureList: { margin: "0 0 24px", paddingLeft: "8px" },
  featureItem: {
    color: "#059669",
    fontSize: "15px",
    lineHeight: "1.5",
    margin: "0 0 8px",
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
