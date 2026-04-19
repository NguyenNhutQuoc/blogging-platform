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

interface CommentNotificationEmailProps {
  /** Post author who receives the notification */
  authorName: string;
  /** Commenter's display name */
  commenterName: string;
  postTitle: string;
  /** Truncated comment preview (first ~200 chars) */
  commentExcerpt: string;
  /** Deep link directly to the comment on the post */
  commentUrl: string;
  siteName?: string;
}

/**
 * Sent to a post author when a new approved comment is posted on their article.
 * Phase 2 only — reply notifications (commenter gets notified of replies) are Phase 4+.
 */
export function CommentNotificationEmail({
  authorName,
  commenterName,
  postTitle,
  commentExcerpt,
  commentUrl,
  siteName = "The Blog",
}: CommentNotificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {commenterName} commented on "{postTitle}"
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>New comment on your post</Heading>

          <Text style={styles.text}>Hi {authorName},</Text>
          <Text style={styles.text}>
            <strong>{commenterName}</strong> left a comment on your post{" "}
            <em>"{postTitle}"</em>:
          </Text>

          <Section style={styles.quoteBox}>
            <Text style={styles.quote}>{commentExcerpt}</Text>
          </Section>

          <Section style={styles.btnSection}>
            <Button href={commentUrl} style={styles.btn}>
              View comment
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            You're receiving this because you're the author of the post. To
            manage notification preferences, visit your {siteName} account
            settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CommentNotificationEmail;

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
  quoteBox: {
    backgroundColor: "#f9fafb",
    borderLeft: "3px solid #7c3aed",
    borderRadius: "4px",
    padding: "12px 16px",
    margin: "16px 0",
  },
  quote: {
    color: "#374151",
    fontStyle: "italic",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0",
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
