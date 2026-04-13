import * as dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Resolve .env from the monorepo root (two levels up from packages/database/src/)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
import { createDbClient } from "./client";
import { users, categories, tags, subscriptionPlans, pages, siteSettings } from "./schema/index";
import { uuidv7 } from "uuidv7";

const db = createDbClient(process.env.DATABASE_URL!);

/**
 * Seed script for local development.
 * Idempotent — safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING).
 *
 * Inserts:
 * - 1 admin user
 * - 2 author users
 * - Sample categories and tags
 * - Subscription plans (Free, Pro, Premium)
 * - Legal pages (Privacy Policy, Terms of Service, etc.)
 * - Site settings
 */
async function seed() {
  console.log("🌱 Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────
  console.log("  → Users");
  await db
    .insert(users)
    .values([
      {
        id: "01900000-0000-7000-8000-000000000001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        bio: "Platform administrator",
        emailVerifiedAt: new Date(),
      },
      {
        id: "01900000-0000-7000-8000-000000000002",
        email: "author1@example.com",
        name: "Alice Writer",
        role: "author",
        status: "active",
        bio: "Passionate about technology and open source.",
        emailVerifiedAt: new Date(),
      },
      {
        id: "01900000-0000-7000-8000-000000000003",
        email: "author2@example.com",
        name: "Bob Developer",
        role: "author",
        status: "active",
        bio: "Full-stack developer, coffee enthusiast.",
        emailVerifiedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  // ── Categories ─────────────────────────────────────────────────────────
  console.log("  → Categories");
  await db
    .insert(categories)
    .values([
      { id: uuidv7(), name: "Technology", slug: "technology", description: "Tech articles and tutorials", sortOrder: 1 },
      { id: uuidv7(), name: "Programming", slug: "programming", description: "Programming tips and best practices", sortOrder: 2 },
      { id: uuidv7(), name: "Design", slug: "design", description: "UI/UX and design articles", sortOrder: 3 },
      { id: uuidv7(), name: "Career", slug: "career", description: "Career advice for developers", sortOrder: 4 },
    ])
    .onConflictDoNothing();

  // ── Tags ───────────────────────────────────────────────────────────────
  console.log("  → Tags");
  await db
    .insert(tags)
    .values([
      { id: uuidv7(), name: "TypeScript", slug: "typescript" },
      { id: uuidv7(), name: "React", slug: "react" },
      { id: uuidv7(), name: "Node.js", slug: "nodejs" },
      { id: uuidv7(), name: "PostgreSQL", slug: "postgresql" },
      { id: uuidv7(), name: "Docker", slug: "docker" },
      { id: uuidv7(), name: "Open Source", slug: "open-source" },
      { id: uuidv7(), name: "Tutorial", slug: "tutorial" },
      { id: uuidv7(), name: "Best Practices", slug: "best-practices" },
    ])
    .onConflictDoNothing();

  // ── Subscription Plans ─────────────────────────────────────────────────
  console.log("  → Subscription plans");
  await db
    .insert(subscriptionPlans)
    .values([
      {
        id: "01900000-0000-7000-8000-000000000010",
        name: "Free",
        slug: "free",
        description: "Access to all free content",
        priceMonthyCents: 0,
        priceYearlyCents: 0,
        features: ["Read free articles", "Comment on posts", "Basic newsletter"],
        limits: { posts_per_month: 0 },
        isActive: true,
        sortOrder: 1,
      },
      {
        id: "01900000-0000-7000-8000-000000000011",
        name: "Pro",
        slug: "pro",
        description: "Access to all pro content + exclusive features",
        priceMonthyCents: 900,
        priceYearlyCents: 8900,
        features: [
          "Everything in Free",
          "Read Pro articles",
          "Early access (48h ahead)",
          "Ad-free experience",
          "Full newsletter",
          "Download PDF",
        ],
        limits: {},
        isActive: true,
        sortOrder: 2,
      },
      {
        id: "01900000-0000-7000-8000-000000000012",
        name: "Premium",
        slug: "premium",
        description: "Full access including exclusive Premium content",
        priceMonthyCents: 1900,
        priceYearlyCents: 17900,
        features: [
          "Everything in Pro",
          "Read Premium articles",
          "Exclusive series & courses",
          "Direct Q&A with authors",
          "Monthly AMA webinar",
          "Priority support",
          "API access",
        ],
        limits: {},
        isActive: true,
        sortOrder: 3,
      },
    ])
    .onConflictDoNothing();

  // ── Legal Pages ─────────────────────────────────────────────────────────
  console.log("  → Legal pages");
  await db
    .insert(pages)
    .values([
      {
        id: uuidv7(),
        title: "Privacy Policy",
        slug: "privacy-policy",
        status: "published",
        content: `<h1>Privacy Policy</h1>
<p>Last updated: ${new Date().toLocaleDateString()}</p>
<h2>1. Data We Collect</h2>
<p>We collect your name, email address, and usage data (page views, reading progress) to provide and improve our service. We do not sell your data to third parties.</p>
<h2>2. How We Use Your Data</h2>
<p>Your data is used to: authenticate your account, personalise your reading experience, send newsletters you have opted into, and process subscription payments via Stripe.</p>
<h2>3. Third-Party Services</h2>
<p>We use Stripe for payment processing and Resend for transactional email. Their privacy policies apply to data processed by them.</p>
<h2>4. Data Retention</h2>
<p>Account data is retained while your account is active. After deletion, data is anonymised within 30 days.</p>
<h2>5. Your Rights (GDPR)</h2>
<p>You have the right to: access, correct, export, or delete your personal data. Contact us at privacy@example.com to exercise these rights.</p>
<h2>6. CCPA</h2>
<p>California residents may request disclosure of personal information we have collected. We do not sell personal information.</p>
<h2>7. Contact</h2>
<p>privacy@example.com</p>`,
        seoTitle: "Privacy Policy",
        seoDescription: "How we collect, use, and protect your personal data.",
      },
      {
        id: uuidv7(),
        title: "Terms of Service",
        slug: "terms-of-service",
        status: "published",
        content: `<h1>Terms of Service</h1>
<p>Last updated: ${new Date().toLocaleDateString()}</p>
<h2>1. Acceptance</h2>
<p>By using this platform you agree to these terms. If you disagree, please do not use the service.</p>
<h2>2. Account Terms</h2>
<p>You are responsible for maintaining the security of your account credentials. You must be 13 years or older to use this service.</p>
<h2>3. Subscription Billing</h2>
<p>Subscriptions are billed monthly or annually. You may cancel at any time; cancellation takes effect at the end of the current billing period. Refunds are available within 7 days of the initial charge.</p>
<h2>4. Content Ownership</h2>
<p>You retain copyright over content you create. By publishing on this platform, you grant us a licence to display and distribute your content to subscribers.</p>
<h2>5. Acceptable Use</h2>
<p>You may not post illegal content, spam, or content that infringes third-party rights. Violations may result in account suspension.</p>
<h2>6. DMCA</h2>
<p>To report copyright infringement, send a notice to dmca@example.com with: description of the work, location of infringing content, and your contact information.</p>
<h2>7. Limitation of Liability</h2>
<p>The service is provided "as is". We are not liable for indirect or consequential damages.</p>`,
        seoTitle: "Terms of Service",
        seoDescription: "Terms governing your use of the platform.",
      },
      {
        id: uuidv7(),
        title: "Refund Policy",
        slug: "refund-policy",
        status: "published",
        content: `<h1>Refund Policy</h1>
<p>We offer a 7-day refund on subscription purchases. After 7 days, charges are non-refundable. To request a refund, contact support@example.com with your order details.</p>`,
        seoTitle: "Refund Policy",
        seoDescription: "Our subscription refund policy.",
      },
    ])
    .onConflictDoNothing();

  // ── Site Settings ──────────────────────────────────────────────────────
  console.log("  → Site settings");
  await db
    .insert(siteSettings)
    .values([
      { key: "site_name", value: "Blog Platform" },
      { key: "site_description", value: "A professional multi-author blogging platform" },
      { key: "site_url", value: "http://localhost:3000" },
      { key: "posts_per_page", value: 20 },
      { key: "allow_guest_comments", value: true },
      { key: "require_comment_approval", value: true },
    ])
    .onConflictDoNothing();

  console.log("✅ Seed complete");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
