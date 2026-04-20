# MEGA PROMPT: Professional Blogging Platform — Monorepo

> **Vai trò của bạn (Claude Code):** Bạn là một Senior Full-Stack Architect kiêm Business Analyst chuyên về content platform. Bạn sẽ thiết kế, planning, và code TOÀN BỘ dự án từ đầu. Tôi là developer sẽ review code của bạn — hãy viết code clean, có comment giải thích business logic, và commit message rõ ràng.

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Mục tiêu

Xây dựng một **Professional Blogging Platform** dạng monorepo với các tính năng:

- Multi-author blogging platform (không phải personal blog)
- Subscription-based monetization (Free / Pro / Premium tiers)
- SEO-first architecture
- Newsletter integration
- Analytics dashboard cho authors
- Admin panel quản lý toàn bộ hệ thống
- Legal compliance (GDPR, DMCA, Terms of Service)

### 1.2 Tech Stack (Bắt buộc)

```
Monorepo Tool    : Turborepo
Frontend (Blog)  : Next.js 16 (App Router, Turbopack default) + TypeScript
Frontend (Admin) : Next.js 16 (App Router, Turbopack default) + TypeScript
Backend API      : Hono.js + TypeScript (chạy trên Node.js/Bun)
Database         : PostgreSQL 16+
ORM              : Drizzle ORM
Cache            : Redis (Upstash Redis hoặc self-hosted)
Job Queue        : BullMQ (Redis-based)
Auth             : Better Auth (https://www.better-auth.com/)
Email            : React Email + Resend
Payment          : Stripe (subscriptions + one-time)
Storage          : S3-compatible (Cloudflare R2 / AWS S3)
Search           : PostgreSQL Full-Text Search (MVP) → Meilisearch (Phase 5+)
Styling          : Tailwind CSS v4 + shadcn/ui
Package Manager  : pnpm
Deployment       : Docker + Docker Compose (dev & production)
CI/CD            : GitHub Actions
```

### 1.3 Next.js 16 — Lưu ý quan trọng

```
- Turbopack là bundler mặc định (KHÔNG cần --turbopack flag nữa)
- Dùng `proxy.ts` thay vì `middleware.ts` (middleware.ts đã deprecated)
- Cache Components: dùng directive `use cache` thay vì experimental PPR
- React 19.2: hỗ trợ View Transitions, useEffectEvent, Activity
- React Compiler: stable, enable qua `reactCompiler: true` trong next.config
- KHÔNG dùng Webpack config — Turbopack là default
```

### 1.4 Mobile-Ready Architecture

```
Vì sẽ có mobile app trong tương lai, kiến trúc cần đảm bảo:
- Hono.js API là standalone, stateless, không phụ thuộc Next.js
- Auth: Better Auth phải hỗ trợ cả session-based (web) và token-based (mobile)
- API responses format chuẩn JSON, versioned (v1), dễ consume từ bất kỳ client nào
- Media upload: presigned URL flow (client upload trực tiếp lên S3, không qua API server)
- Push notification hooks: sẵn sàng cho mobile (để trống, chưa implement)
- API documentation: OpenAPI/Swagger spec auto-generated từ Hono routes (dùng @hono/zod-openapi)
  → Mobile dev có thể dùng spec này để generate SDK
```

---

## 2. MONOREPO STRUCTURE

Hãy tạo cấu trúc monorepo sau:

```
blog-platform/
├── apps/
│   ├── web/                    # Public-facing blog (Next.js 16)
│   │   ├── proxy.ts            # ⚠️ Next.js 16: dùng proxy.ts KHÔNG dùng middleware.ts
│   │   └── ...
│   ├── admin/                  # Admin dashboard (Next.js 16)
│   └── api/                    # Backend API (Hono.js + @hono/zod-openapi)
├── packages/
│   ├── database/               # Drizzle schema, migrations, seed
│   ├── shared/                 # Shared types, utils, constants
│   ├── ui/                     # Shared UI components (shadcn-based)
│   ├── email-templates/        # React Email templates
│   ├── api-client/             # Type-safe API client (dùng chung cho web, admin, và mobile sau này)
│   ├── config-typescript/      # Shared tsconfig
│   ├── config-eslint/          # Shared ESLint config
│   └── validators/             # Zod schemas (shared validation — dùng chung API + frontend)
├── tooling/
│   ├── docker/                 # Dockerfiles + compose
│   └── scripts/                # DB seed, migration scripts
├── .github/
│   └── workflows/              # CI/CD pipelines
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

> **Về `packages/api-client`:** Đây là package quan trọng cho mobile-ready architecture.
> Nó wrap tất cả API calls thành typed functions, dùng được từ Next.js (server components, client components)
> và sau này từ React Native. Được auto-generate hoặc hand-written từ OpenAPI spec của Hono.

---

## 3. DATABASE DESIGN (PostgreSQL + Drizzle ORM)

### 3.1 Nguyên tắc thiết kế Database

- Sử dụng **UUID v7** cho tất cả primary key (sortable + unique)
- Tất cả bảng có `created_at`, `updated_at` (auto-managed)
- Soft delete bằng `deleted_at` cho các entity quan trọng
- Sử dụng PostgreSQL-specific features: `tsvector` cho full-text search, `jsonb` cho flexible metadata, `enum` cho status fields
- Index strategy rõ ràng: composite indexes cho query patterns phổ biến
- **MVP: dùng schema `public` cho tất cả bảng**, phân biệt bằng prefix naming (`billing_subscriptions`, `analytics_page_views`). Tách schema riêng khi scale lên Phase 5+.

### 3.2 Core Tables

#### Auth Tables

```
- users: id, email, name, avatar_url, bio, role(admin/editor/author/subscriber),
         email_verified_at, status(active/suspended/banned), metadata(jsonb),
         created_at, updated_at, deleted_at

- sessions: (managed by Better Auth — cookie-based cho web)
- accounts: (managed by Better Auth — OAuth providers: Google, GitHub)
- verification_tokens: (managed by Better Auth)

⚠️ MOBILE-READY AUTH:
Better Auth cần config dual strategy:
  - Web (Next.js): session-based (httpOnly cookie)
  - Mobile (future): Bearer token (JWT hoặc opaque token)
  → Dùng Better Auth plugin "bearer" hoặc custom token endpoint
  → API middleware phải check cả 2: cookie HOẶC Authorization header
```

#### Content Tables

```
- posts: id, author_id(→users), title, slug(unique), excerpt,
         content(text — HTML, rendered output từ Tiptap editor),
         content_json(jsonb — Tiptap ProseMirror JSON state, dùng để load lại editor),
         cover_image_url, status(draft/published/scheduled/archived),
         visibility(free/pro/premium),
         published_at, scheduled_at,
         reading_time_minutes(computed), word_count(computed),
         seo_title, seo_description, seo_canonical_url, og_image_url,
         search_vector(tsvector — auto-generated),
         metadata(jsonb), created_at, updated_at, deleted_at

- categories: id, name, slug(unique), description, parent_id(self-ref),
              cover_image_url, sort_order, created_at, updated_at

- tags: id, name, slug(unique), description, created_at

- post_tags: post_id, tag_id (many-to-many junction)

- post_categories: post_id, category_id (many-to-many junction)

- series: id, author_id, title, slug, description, cover_image_url,
          status(ongoing/completed), sort_order, created_at, updated_at

- series_posts: series_id, post_id, order_in_series

- comments: id, post_id, author_id(nullable — guest comments),
            parent_id(self-ref for threading), content,
            status(pending/approved/spam/deleted),
            guest_name, guest_email,
            ip_address, user_agent,
            created_at, updated_at, deleted_at

- media: id, uploader_id(→users), filename, original_filename,
         mime_type, size_bytes, width, height,
         storage_key(S3 key), url, alt_text, caption,
         folder, metadata(jsonb — EXIF etc),
         created_at, updated_at

- revisions: id, post_id, editor_id(→users), content, content_json,
             revision_number, change_summary, created_at
```

#### Billing Tables (prefix: `billing_`)

```
- subscription_plans: id, name, slug, description,
                      stripe_price_id_monthly, stripe_price_id_yearly,
                      price_monthly_cents, price_yearly_cents,
                      features(jsonb), limits(jsonb),
                      is_active, sort_order, created_at, updated_at

- subscriptions: id, user_id(→users), plan_id(→subscription_plans),
                 stripe_subscription_id, stripe_customer_id,
                 status(active/past_due/canceled/trialing/paused),
                 current_period_start, current_period_end,
                 cancel_at, canceled_at, trial_end,
                 metadata(jsonb), created_at, updated_at

- payment_history: id, user_id, subscription_id(nullable),
                   stripe_payment_intent_id, stripe_invoice_id,
                   amount_cents, currency, status(succeeded/failed/refunded),
                   description, metadata(jsonb), created_at

- coupons: id, code(unique), description, discount_type(percentage/fixed),
           discount_value, max_uses, current_uses,
           valid_from, valid_until, is_active, created_at
```

#### Newsletter Tables

```
- newsletter_subscribers: id, email(unique), name,
                          status(active/unsubscribed/bounced/complained),
                          source(signup_form/import/checkout),
                          subscribed_at, unsubscribed_at,
                          metadata(jsonb), created_at

- newsletters: id, author_id, subject, preview_text,
               content_html, content_text,
               status(draft/scheduled/sending/sent),
               scheduled_at, sent_at,
               stats_sent, stats_opened, stats_clicked,
               created_at, updated_at

- newsletter_sends: id, newsletter_id, subscriber_id,
                    status(pending/sent/delivered/opened/clicked/bounced/complained),
                    sent_at, opened_at, clicked_at
```

#### Analytics Tables (prefix: `analytics_`)

```
- page_views: id, post_id(nullable), session_id, visitor_id(anonymous hash),
              path, referrer, utm_source, utm_medium, utm_campaign,
              country, city, device_type, browser, os,
              created_at

- post_reactions: id, post_id, user_id(nullable), reaction_type(like/love/insightful/bookmark),
                  created_at

- reading_progress: id, post_id, user_id(nullable), session_id,
                    scroll_depth_percent, time_spent_seconds,
                    finished_reading(boolean), created_at, updated_at
```

#### System Tables

```
- site_settings: key(pk), value(jsonb), updated_at, updated_by(→users)

- redirects: id, from_path, to_path, status_code(301/302), is_active, created_at

- audit_logs: id, actor_id(→users), action, entity_type, entity_id,
              old_values(jsonb), new_values(jsonb), ip_address, user_agent,
              created_at

- pages: id, title, slug(unique), content, status(draft/published),
         seo_title, seo_description, created_at, updated_at
         (dùng cho: About, Contact, Privacy Policy, Terms of Service, etc.)
```

### 3.3 Index Strategy

```sql
-- Performance-critical indexes
CREATE INDEX idx_posts_slug ON posts(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_status_published ON posts(status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author ON posts(author_id, status, published_at DESC);
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);
CREATE INDEX idx_posts_visibility ON posts(visibility, status);

CREATE INDEX idx_comments_post ON comments(post_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_page_views_post_date ON analytics_page_views(post_id, created_at);
CREATE INDEX idx_page_views_session ON analytics_page_views(session_id, created_at);

CREATE INDEX idx_subscriptions_user ON billing_subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_stripe ON billing_subscriptions(stripe_subscription_id);

CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers(email) WHERE status = 'active';
CREATE INDEX idx_newsletter_subscribers_status ON newsletter_subscribers(status);
```

---

## 4. API DESIGN (Hono.js)

### 4.1 API Architecture

```
apps/api/src/
├── index.ts                    # App entry point
├── app.ts                      # Hono app setup (dùng OpenAPIHono từ @hono/zod-openapi)
├── middleware/
│   ├── auth.ts                 # Dual auth: cookie (web) + Bearer token (mobile-ready)
│   ├── rate-limit.ts           # Rate limiting per route
│   ├── cors.ts                 # CORS config (whitelist web + admin + future mobile)
│   ├── error-handler.ts        # Global error handling
│   ├── logger.ts               # Request logging
│   └── cache.ts                # Redis cache middleware
├── routes/
│   ├── v1/
│   │   ├── auth/               # Auth routes (login, register, OAuth)
│   │   ├── posts/              # CRUD + publish/schedule
│   │   ├── categories/
│   │   ├── tags/
│   │   ├── comments/
│   │   ├── media/              # Upload, list, delete
│   │   ├── users/              # Profile, settings
│   │   ├── subscriptions/      # Plans, subscribe, cancel
│   │   ├── newsletters/        # CRUD + send
│   │   ├── analytics/          # Dashboard data
│   │   ├── admin/              # Admin-only routes
│   │   ├── search/             # Full-text search
│   │   ├── webhooks/           # Stripe webhooks
│   │   └── public/             # Public API (RSS, sitemap, etc.)
│   └── health.ts               # Health check
├── services/                   # Business logic layer
│   ├── post.service.ts
│   ├── auth.service.ts
│   ├── subscription.service.ts
│   ├── newsletter.service.ts
│   ├── media.service.ts
│   ├── search.service.ts
│   ├── analytics.service.ts
│   └── email.service.ts
├── jobs/                       # BullMQ background jobs
│   ├── queue.ts                # Queue definitions + Redis connection
│   ├── workers/
│   │   ├── newsletter.worker.ts    # Send newsletters in batches
│   │   ├── scheduled-post.worker.ts # Publish scheduled posts
│   │   ├── email.worker.ts         # Transactional emails (welcome, password reset)
│   │   ├── image.worker.ts         # Image optimization after upload (resize, WebP/AVIF)
│   │   ├── search-index.worker.ts  # Sync posts to search index
│   │   └── analytics.worker.ts     # Aggregate analytics data
│   └── schedules/
│       ├── publish-scheduled.ts    # Cron: check & publish scheduled posts every minute
│       └── analytics-rollup.ts     # Cron: daily analytics aggregation
├── lib/
│   ├── db.ts                   # Database connection
│   ├── redis.ts                # Redis client (shared: cache + BullMQ)
│   ├── stripe.ts               # Stripe client
│   ├── s3.ts                   # S3 client
│   ├── search.ts               # PostgreSQL FTS helpers (MVP), swap to Meilisearch later
│   └── resend.ts               # Email client
├── openapi/                    # Auto-generated OpenAPI spec
│   └── swagger.ts              # Scalar UI cho API docs tại /api/docs
└── types/                      # API-specific types
```

> **QUAN TRỌNG — @hono/zod-openapi:**
> Dùng `OpenAPIHono` thay vì `Hono` để define routes. Mỗi route được define bằng
> `createRoute()` với Zod schema → auto-generate OpenAPI 3.1 spec.
> Expose spec tại `GET /api/v1/openapi.json` và Scalar UI tại `GET /api/docs`.
> → Mobile dev sau này dùng spec này để generate typed SDK (Swift, Kotlin).

### 4.2 API Endpoints Summary

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/verify-email
GET    /api/v1/auth/me
POST   /api/v1/auth/refresh

# Posts
GET    /api/v1/posts                    # List (with pagination, filters)
GET    /api/v1/posts/:slug              # Get by slug (public)
POST   /api/v1/posts                    # Create (author+)
PUT    /api/v1/posts/:id                # Update
DELETE /api/v1/posts/:id                # Soft delete
POST   /api/v1/posts/:id/publish        # Publish
POST   /api/v1/posts/:id/schedule       # Schedule
POST   /api/v1/posts/:id/archive        # Archive
GET    /api/v1/posts/:id/revisions      # Revision history
POST   /api/v1/posts/:id/revisions/:rid/restore  # Restore revision

# Categories & Tags
GET    /api/v1/categories
POST   /api/v1/categories               # Admin only
PUT    /api/v1/categories/:id
DELETE /api/v1/categories/:id
GET    /api/v1/tags
POST   /api/v1/tags
DELETE /api/v1/tags/:id

# Comments
GET    /api/v1/posts/:postId/comments   # Threaded comments
POST   /api/v1/posts/:postId/comments   # Add comment
PUT    /api/v1/comments/:id             # Edit own comment
DELETE /api/v1/comments/:id             # Delete
PATCH  /api/v1/comments/:id/status      # Moderate (admin)

# Media
POST   /api/v1/media/upload             # Upload (presigned URL)
GET    /api/v1/media                    # List with pagination
DELETE /api/v1/media/:id
PUT    /api/v1/media/:id                # Update alt text, caption

# Users
GET    /api/v1/users/:id/profile        # Public profile
PUT    /api/v1/users/me                 # Update own profile
GET    /api/v1/users/me/posts           # My posts
GET    /api/v1/users/me/bookmarks       # My bookmarks

# Subscriptions
GET    /api/v1/subscriptions/plans      # List available plans
POST   /api/v1/subscriptions/checkout   # Create Stripe checkout session
POST   /api/v1/subscriptions/portal     # Stripe customer portal
GET    /api/v1/subscriptions/me         # Current subscription status
POST   /api/v1/webhooks/stripe          # Stripe webhook handler

# Newsletter
POST   /api/v1/newsletter/subscribe     # Public subscribe
POST   /api/v1/newsletter/unsubscribe   # Unsubscribe (with token)
GET    /api/v1/newsletters              # List (admin)
POST   /api/v1/newsletters              # Create draft
PUT    /api/v1/newsletters/:id
POST   /api/v1/newsletters/:id/send     # Send to subscribers
POST   /api/v1/newsletters/:id/schedule # Schedule send

# Analytics
GET    /api/v1/analytics/overview       # Dashboard stats
GET    /api/v1/analytics/posts/:id      # Per-post analytics
GET    /api/v1/analytics/realtime       # Real-time visitors
POST   /api/v1/analytics/track          # Track page view (public)

# Search
GET    /api/v1/search?q=...&filters=... # Full-text search

# Admin
GET    /api/v1/admin/users              # User management
PATCH  /api/v1/admin/users/:id/role     # Change role
PATCH  /api/v1/admin/users/:id/status   # Suspend/ban
GET    /api/v1/admin/audit-logs         # Audit trail
PUT    /api/v1/admin/settings           # Site settings
GET    /api/v1/admin/stats              # System stats

# Public
GET    /api/v1/public/rss               # RSS feed
GET    /api/v1/public/sitemap           # Sitemap XML
GET    /api/v1/public/robots            # robots.txt
```

---

## 5. SUBSCRIPTION & MONETIZATION MODEL

### 5.1 Subscription Tiers

```
FREE (Visitor/Registered User):
├── Đọc tất cả bài viết có visibility = "free"
├── Comment (sau khi đăng ký)
├── Bookmark bài viết
├── Nhận newsletter cơ bản (weekly digest)
└── Giới hạn: Không đọc được bài Pro/Premium

PRO ($9/month hoặc $89/year):
├── Tất cả quyền của Free
├── Đọc bài viết có visibility = "pro"
├── Early access (bài mới trước 48h)
├── Ad-free experience
├── Nhận newsletter đầy đủ (bao gồm exclusive content)
├── Download bài viết dạng PDF
├── Tham gia community discussions
└── Giới hạn: Không đọc được bài Premium

PREMIUM ($19/month hoặc $179/year):
├── Tất cả quyền của Pro
├── Đọc TẤT CẢ bài viết (bao gồm Premium)
├── Access series/courses exclusive
├── Direct Q&A với authors
├── Monthly exclusive webinar/AMA
├── Priority support
├── API access (nếu có)
└── Custom RSS feed
```

### 5.2 Stripe Integration Logic

```
- Checkout flow:
  1. User chọn plan → POST /subscriptions/checkout
  2. Server tạo Stripe Checkout Session với price_id tương ứng
  3. Redirect user đến Stripe Checkout
  4. Stripe webhook → cập nhật subscription status

- Webhook events cần handle:
  • checkout.session.completed → Tạo subscription record
  • invoice.paid → Extend subscription
  • invoice.payment_failed → Mark as past_due, send email
  • customer.subscription.updated → Sync plan changes
  • customer.subscription.deleted → Mark as canceled

- Customer Portal: cho user tự manage (upgrade/downgrade/cancel)
- Trial: 14 ngày trial cho Pro plan
- Coupon system: Admin tạo coupon code → apply khi checkout
```

---

## 6. FEATURES CHI TIẾT

### 6.1 Blog Editor

- Sử dụng **Tiptap** hoặc **Novel** (Tiptap-based) editor
- **Output format:** HTML (rendered, lưu vào `content`) + ProseMirror JSON (editor state, lưu vào `content_json`)
  → KHÔNG dùng MDX. Tiptap native output là HTML + JSON.
  → `content_json` dùng để load lại editor khi edit bài. `content` dùng để render cho reader.
- Hỗ trợ: headings, bold, italic, links, images, code blocks, embeds (YouTube, Twitter), callouts, tables
- Auto-save draft mỗi 30 giây (debounced API call)
- Revision history (giữ 50 revisions gần nhất)
- SEO preview panel (title, description, OG image)
- Cover image upload with drag-and-drop
- Slug auto-generate từ title (có thể edit)
- Schedule publish (chọn ngày giờ → tạo BullMQ job)
- Reading time auto-calculate (word_count / 200 wpm)

### 6.2 SEO

- Dynamic sitemap.xml generation
- RSS feed (full + per-category + per-author)
- robots.txt configurable
- Structured data (JSON-LD): Article, BreadcrumbList, Organization
- Open Graph + Twitter Card meta tags
- Canonical URL support
- Auto-generate alt text suggestions cho images
- Internal linking suggestions

### 6.3 Newsletter System

- Double opt-in subscription flow
- Segment subscribers by plan tier
- Template-based emails (React Email)
- Schedule sends
- Track opens/clicks (pixel tracking + redirect links)
- Unsubscribe with one-click (RFC 8058 compliant)
- Import/export subscribers CSV
- Bounce/complaint handling (auto-unsubscribe)

### 6.4 Analytics (Privacy-Friendly)

- Không dùng cookies cho tracking (fingerprint-free)
- Track: page views, unique visitors, referrers, countries, devices
- Per-post analytics: views, reading time, scroll depth, reactions
- Author dashboard: overview của tất cả bài viết
- Admin dashboard: site-wide metrics
- Real-time active visitors (WebSocket hoặc polling)
- Export data CSV

### 6.5 Media Management

- Upload to S3/R2 with presigned URLs
- Image optimization on upload (sharp/libvips): resize, WebP/AVIF
- Responsive image srcset generation
- Folder organization
- Search by filename/alt text
- Bulk operations (delete, move)
- Storage quota per user role

### 6.6 Search

```
MVP (Phase 1-4): PostgreSQL Full-Text Search
- Dùng tsvector column trên posts (title, content, tags)
- GIN index cho fast search
- Ranked results (ts_rank)
- Search by: title, content, category, tag, author
- Highlight matched terms (ts_headline)
- Vietnamese language support: dùng 'simple' dictionary hoặc custom config

Phase 5+ (Optional upgrade): Meilisearch
- Nếu PostgreSQL FTS không đủ: typo-tolerant, instant search, faceted filtering
- Migration path: BullMQ worker sync posts → Meilisearch index
- Search API abstraction layer (swap implementation mà không đổi API contract)
```

### 6.7 Comments System

- Threaded replies (max 3 levels deep)
- Guest commenting (with name + email, no account needed)
- Markdown support in comments
- Spam detection (Akismet integration hoặc basic heuristics)
- Moderation queue (admin approve/reject/spam)
- Author can pin/highlight comments
- Email notification cho replies

---

## 7. LEGAL & COMPLIANCE

### 7.1 Các trang pháp lý cần tạo (dạng seed content)

Hãy tạo **template content** cho các trang sau (trong file seed):

1. **Privacy Policy** — bao gồm:
   - Data collection (email, name, IP, analytics)
   - Cookie usage (nếu có)
   - Third-party services (Stripe, analytics)
   - Data retention policy
   - User rights (access, deletion, portability)
   - GDPR compliance section
   - CCPA compliance section
   - Contact information

2. **Terms of Service** — bao gồm:
   - Account terms
   - Subscription terms (billing, refund policy)
   - Content ownership (user retains copyright)
   - Acceptable use policy
   - DMCA takedown procedure
   - Limitation of liability
   - Termination clause

3. **Cookie Policy** — nếu dùng cookies

4. **DMCA Policy** — quy trình nhận và xử lý DMCA takedown request

5. **Refund Policy** — cho subscriptions:
   - Pro-rata refund nếu cancel trong 7 ngày đầu
   - Không refund sau 7 ngày
   - Refund process qua Stripe

### 7.2 Technical Compliance

```
- GDPR:
  • Consent banner cho cookies/tracking
  • Data export endpoint (GET /api/v1/users/me/data-export)
  • Account deletion endpoint (DELETE /api/v1/users/me — full data wipe after 30 days grace period)
  • Privacy-friendly analytics (no PII in analytics)

- Email:
  • CAN-SPAM compliant (physical address in footer, unsubscribe link)
  • GDPR double opt-in for newsletter
  • One-click unsubscribe header (RFC 8058)

- Security:
  • Rate limiting on all endpoints
  • CSRF protection
  • XSS prevention (sanitize user content)
  • SQL injection prevention (parameterized queries via Drizzle)
  • Helmet-style security headers
  • Content Security Policy
```

---

## 8. ADMIN DASHBOARD FEATURES

```
Dashboard Overview:
├── Total users, posts, comments, revenue (MRR/ARR)
├── Charts: new users/day, revenue/month, posts/week
├── Recent activity feed

User Management:
├── List users with filters (role, status, plan)
├── View user detail + activity
├── Change role, suspend, ban
├── Impersonate user (admin only)

Content Management:
├── All posts with filters
├── Moderation queue (pending comments, reported content)
├── Categories/Tags management (CRUD + merge tags)
├── Series management
├── Pages management (About, Contact, Legal pages)
├── Media library browser

Subscription Management:
├── Active subscriptions overview
├── Revenue dashboard (MRR, churn rate, LTV)
├── Coupon management (create, deactivate)
├── Subscription plan editor

Newsletter:
├── Subscriber list + segments
├── Create/send newsletters
├── Send history + stats (open rate, click rate)
├── Import/export

Settings:
├── Site settings (name, description, logo, social links)
├── SEO defaults
├── Email templates
├── Redirect manager
├── Audit log viewer

Analytics:
├── Site-wide traffic
├── Top posts
├── Referrer analysis
├── Geographic breakdown
├── Device/browser stats
```

---

## 9. MVP SCOPE — QUAN TRỌNG

```
⚠️ CHỈ LÀM PHASE 1 + PHASE 2 TRƯỚC.
Sau khi hoàn thành Phase 2, DỪNG LẠI để tôi review toàn bộ.
Tôi sẽ quyết định có tiếp Phase 3+ hay không.

MVP = Platform có thể:
  ✅ Đăng ký / đăng nhập
  ✅ Tạo, edit, publish bài viết (với Tiptap editor)
  ✅ Hiển thị blog public (listing + detail + SEO)
  ✅ Categories, tags, series
  ✅ Comments (threaded)
  ✅ Full-text search (PostgreSQL FTS)
  ✅ Media upload (S3)
  ✅ Draft / Publish / Schedule workflow
  ✅ Revision history
  ✅ BullMQ jobs cho scheduled posts + image processing

  ❌ CHƯA CẦN: Subscriptions, payments, newsletter, analytics dashboard, admin panel
  ❌ CHƯA CẦN: Meilisearch (PostgreSQL FTS đủ cho MVP)
```

---

## 10. JOB QUEUE (BullMQ)

### 10.1 Tại sao cần Job Queue

```
Nhiều tác vụ KHÔNG nên chạy synchronous trong API request:
- Gửi email (slow, có thể fail, cần retry)
- Publish scheduled posts (cần cron job check mỗi phút)
- Optimize images sau upload (CPU-intensive)
- Gửi newsletter cho hàng nghìn subscribers (batched)
- Sync posts vào search index
- Aggregate analytics data (daily rollup)

→ BullMQ dùng Redis, đã có sẵn trong stack. Không cần thêm infra.
```

### 10.2 Queue Design

```
Queues:
├── email-queue          # Transactional emails (welcome, reset password, payment failed)
│   └── Retry: 3 lần, backoff exponential (1s, 5s, 30s)
├── newsletter-queue     # Bulk newsletter sending
│   └── Rate limit: 100 emails/giây (tùy Resend plan)
│   └── Batched: chia subscriber list thành chunks 100
├── post-schedule-queue  # Cron job: check scheduled posts mỗi phút
│   └── Repeatable job: every 60 seconds
├── image-queue          # Image optimization after upload
│   └── Concurrency: 2 (CPU-intensive)
│   └── Tasks: resize → WebP/AVIF → generate srcset → update media record
├── search-index-queue   # Sync post changes to search index
│   └── Debounced: 5 giây sau khi post saved (tránh index quá nhiều lần khi editing)
└── analytics-queue      # Daily aggregation
    └── Repeatable job: every day at 03:00 UTC

Worker deployment:
- Dev: Workers chạy cùng process với API server
- Production: Workers chạy riêng process (scale độc lập)
  → Thêm entry point: `apps/api/src/worker.ts`
```

---

## 11. CACHING STRATEGY

### 11.1 Redis Cache Layers

```
Layer 1 — API Response Cache:
├── GET /api/v1/posts (published, paginated)
│   └── Key: `posts:list:page:{n}:size:{n}`  TTL: 5 phút
│   └── Invalidate: khi post published/unpublished/deleted
├── GET /api/v1/posts/:slug
│   └── Key: `posts:slug:{slug}`  TTL: 10 phút
│   └── Invalidate: khi post updated
├── GET /api/v1/categories
│   └── Key: `categories:all`  TTL: 1 giờ
│   └── Invalidate: khi category CRUD
└── GET /api/v1/subscriptions/plans
    └── Key: `plans:active`  TTL: 1 giờ

Layer 2 — Session Cache:
├── Better Auth sessions: managed by Better Auth (Redis adapter)
└── Rate limit counters: `ratelimit:{ip}:{route}`  TTL: 1 phút

Layer 3 — Computed Data Cache:
├── Post reading time: computed on save, stored in DB (không cần cache)
├── Author stats: `author:{id}:stats`  TTL: 15 phút
└── Site-wide stats (admin): `admin:stats`  TTL: 5 phút
```

### 11.2 Cache Invalidation Strategy

```
Pattern: Write-through invalidation
- Khi data thay đổi → delete related cache keys (không update cache)
- Next request sẽ cache miss → fetch fresh data → cache lại

Helper function:
  invalidateCache(patterns: string[])
  → Dùng Redis SCAN + DEL cho wildcard patterns
  → Ví dụ: invalidateCache(['posts:*']) khi post published

Edge cases:
- Bulk operations (import posts, bulk delete): invalidate ALL post cache
- Category rename: invalidate categories + all post caches (vì post có category info)
```

### 11.3 Next.js 16 Caching (Frontend)

```
- Dùng `use cache` directive cho:
  • Layout components (sidebar, navigation — thay đổi ít)
  • Blog listing page (cache per page number)
  • Static pages (About, Privacy Policy)
- KHÔNG cache:
  • Post detail page nếu có gated content (phụ thuộc user subscription)
  • Admin dashboard (luôn fresh)
  • Auth-related pages
- Config: `cacheComponents: true` trong next.config.ts
```

---

## 12. BACKUP & DISASTER RECOVERY

```
Database Backup:
├── Automated: pg_dump daily lúc 02:00 UTC → upload lên S3 bucket riêng
├── Retention: giữ 30 ngày, sau đó xóa
├── Script: tooling/scripts/backup-db.sh
├── Docker: thêm backup container trong docker-compose.prod.yml
│   └── Dùng image: prodrigestivill/postgres-backup-local hoặc custom script
└── Test restore: document cách restore từ backup

Media Backup:
├── S3/R2 đã có built-in redundancy
├── Enable versioning trên S3 bucket
└── Cross-region replication (optional, Phase 6+)

Redis:
├── Redis data là ephemeral (cache + job queue) → KHÔNG cần backup
├── Nếu Redis restart: cache tự rebuild, jobs re-enqueue
└── Persistent data PHẢI ở PostgreSQL, KHÔNG ở Redis

Environment & Secrets:
├── .env files: KHÔNG commit vào git
├── Production secrets: dùng Docker secrets hoặc cloud provider secret manager
└── Document tất cả env vars trong .env.example với mô tả rõ ràng

Recovery Procedure (document trong README):
├── 1. Restore PostgreSQL từ latest backup
├── 2. Restart Redis (cache tự rebuild)
├── 3. Verify S3 media access
├── 4. Run migrations (nếu có pending)
└── 5. Health check endpoints
```

---

## 13. TESTING STRATEGY

### 13.1 Testing Stack

```
Framework    : Vitest
HTTP Testing : supertest hoặc Hono test client (app.request)
DB Testing   : Test database riêng (blog_platform_test) + migrate trước mỗi test suite
Mocking      : vi.mock cho external services (Stripe, Resend, S3)
Coverage     : Minimum 70% cho services layer
```

### 13.2 Test Categories & Priority

```
🔴 CRITICAL — Phải có trước khi ship MVP:

Unit Tests (packages/validators/):
├── Tất cả Zod schemas validate đúng/sai
└── Shared utility functions

Service Tests (apps/api/src/services/):
├── auth.service: register, login, session validation, role check
├── post.service: create, update, publish, schedule, soft delete
├── post.service: visibility gating logic (free/pro/premium)
├── comment.service: create, thread, moderate
└── media.service: upload presigned URL generation

API Integration Tests (apps/api/):
├── Auth flow: register → verify email → login → access protected route → logout
├── Post lifecycle: create draft → edit → add cover image → publish → verify public access
├── Post scheduling: create → schedule → verify BullMQ job created → mock time → verify published
├── Comment flow: post comment → reply → moderate (approve/spam)
├── Role-based access: author vs editor vs admin permissions
└── Error cases: invalid input (Zod), unauthorized, not found, rate limited

🟡 IMPORTANT — Thêm khi làm Phase 3+:
├── Stripe webhook handler tests (mock webhook events)
├── Subscription gating: free user → cannot access pro content
├── Newsletter: subscribe → double opt-in → receive → unsubscribe
├── Search: create post → verify FTS index → search → verify results
└── GDPR: data export, account deletion

🟢 NICE TO HAVE:
├── E2E tests (Playwright) cho critical user flows
├── Load testing script (k6) cho API endpoints
└── Visual regression tests cho blog frontend
```

### 13.3 Test Database Setup

```
- Docker Compose có service `postgres-test` chạy trên port 5433
- Mỗi test suite: reset DB bằng Drizzle migrate + truncate
- Seed data fixtures cho common test scenarios
- CI: GitHub Actions chạy test với PostgreSQL + Redis services
```

---

## 14. DEVELOPMENT WORKFLOW

### 14.1 Thứ tự triển khai (Phase-by-Phase)

```
PHASE 1 — Foundation (Do this FIRST):
├── 1. Monorepo setup (Turborepo + pnpm workspace)
├── 2. Shared packages (typescript config, eslint, shared types, validators)
├── 3. Database package (Drizzle schema + migrations + connection)
├── 4. Docker Compose (PostgreSQL + Redis) — KHÔNG cần Meilisearch cho MVP
├── 5. API scaffolding (Hono.js + @hono/zod-openapi + middleware + health check)
├── 6. OpenAPI spec auto-gen + Scalar docs UI tại /api/docs
├── 7. Auth system (Better Auth: session cho web + bearer token cho mobile-ready)
├── 8. api-client package (typed API client dùng chung cho web/admin/mobile)
├── 9. BullMQ setup (queue definitions, worker entry point, cron schedules)
├── 10. Basic seed data script
└── 11. Test infrastructure (Vitest + test DB + CI config)

PHASE 2 — Core Content (MVP):
├── 1. Posts CRUD API + service layer + TESTS
├── 2. Categories & Tags API + TESTS
├── 3. Media upload (S3 integration + image optimization via BullMQ)
├── 4. Blog frontend — listing page, post detail page (Next.js 16 + `use cache`)
├── 5. Blog editor (Tiptap/Novel — output HTML + JSON)
├── 6. Draft/Publish/Schedule workflow (scheduled publish via BullMQ cron)
├── 7. Revision system
├── 8. Comments API + frontend + TESTS
├── 9. Search (PostgreSQL Full-Text Search — KHÔNG dùng Meilisearch)
└── 10. SEO basics (sitemap, RSS, structured data, OG tags)
⚠️ DỪNG SAU PHASE 2. CHỜ REVIEW.

PHASE 3 — Monetization:
├── 1. Subscription plans (DB + API)
├── 2. Stripe integration (checkout, portal, webhooks) + TESTS
├── 3. Content gating (visibility-based access control) + TESTS
├── 4. Payment history
├── 5. Coupon system
└── 6. Subscription emails via BullMQ (welcome, payment failed, canceled)

PHASE 4 — Newsletter & Analytics:
├── 1. Newsletter subscriber management
├── 2. Newsletter creation + sending via BullMQ (React Email + Resend)
├── 3. Email tracking (opens, clicks)
├── 4. Page view tracking endpoint
├── 5. Analytics dashboard (author + admin)
├── 6. Analytics daily aggregation via BullMQ cron
└── 7. Real-time visitors

PHASE 5 — Admin & Polish:
├── 1. Admin dashboard (all sections)
├── 2. User management
├── 3. Audit logging
├── 4. Legal pages (seeded content)
├── 5. GDPR compliance endpoints + TESTS
├── 6. Rate limiting & security hardening
├── 7. (Optional) Migrate search từ PostgreSQL FTS → Meilisearch
└── 8. Documentation (README, API docs)

PHASE 6 — Production Ready:
├── 1. Production Docker setup (separate API + worker containers)
├── 2. CI/CD pipeline (GitHub Actions: lint → test → build → deploy)
├── 3. Environment variable management
├── 4. Database backup automation (pg_dump → S3)
├── 5. Error monitoring setup (Sentry-ready)
├── 6. Performance optimization (Redis caching strategy)
├── 7. Load testing considerations
└── 8. Deployment + recovery documentation
```

### 14.2 Coding Standards

```
- Mọi function phải có JSDoc comment giải thích business logic
- Sử dụng Zod cho TOÀN BỘ input validation (shared trong packages/validators)
- Error handling nhất quán: custom AppError class với error codes
- API responses format thống nhất: { success, data, error, meta(pagination) }
- Tách rõ: Route → Controller logic → Service → Repository(Drizzle queries)
- Không hardcode values — dùng constants hoặc env vars
- Mỗi file có mục đích rõ ràng (single responsibility)
- TypeScript strict mode — no `any` type
- Mọi service function có unit test tương ứng
```

### 14.3 Environment Variables (.env.example)

```env
# App
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3003
ADMIN_URL=http://localhost:3002

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blog_platform
DATABASE_TEST_URL=postgresql://postgres:postgres@localhost:5433/blog_platform_test

# Redis (shared: cache + BullMQ + rate limiting)
REDIS_URL=redis://localhost:6379

# Auth (Better Auth)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3003/api/v1/auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Stripe (Phase 3+ — không cần cho MVP)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# S3 / R2
S3_ENDPOINT=
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=blog-media

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Meilisearch (Phase 5+ — KHÔNG cần cho MVP, dùng PostgreSQL FTS)
# MEILISEARCH_HOST=http://localhost:7700
# MEILISEARCH_API_KEY=your-master-key

# Analytics
ANALYTICS_SALT=random-salt-for-visitor-hashing

# Backup (Phase 6+)
# BACKUP_S3_BUCKET=blog-backups
# BACKUP_RETENTION_DAYS=30
```

---

## 15. YÊU CẦU BẮT BUỘC KHÁC

### 15.1 Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Mỗi phase hoàn thành = 1 commit message rõ ràng
- Giữ `.gitignore` sạch
- Branch strategy: `main` (stable) + `develop` (working)

### 15.2 Documentation

- README.md tổng quan dự án + hướng dẫn setup (docker compose up → ready)
- Mỗi package có README riêng giải thích purpose + usage
- API documentation: auto-generated từ @hono/zod-openapi → Scalar UI tại /api/docs
- Database ERD diagram (Mermaid trong docs/)
- Recovery procedure document

---

## 16. BẮT ĐẦU

**Hãy bắt đầu với PHASE 1 — Foundation.**

Trước khi code, hãy:

1. Xác nhận lại tech stack và structure với tôi
2. Liệt kê các dependencies chính sẽ cài (với version numbers)
3. Bắt đầu từ monorepo setup

**Sau khi hoàn thành Phase 2 → DỪNG LẠI.**
Tóm tắt những gì đã làm, liệt kê test results, và chờ tôi review trước khi tiếp tục.

**LƯU Ý QUAN TRỌNG:**

- Tôi sẽ review code rất kĩ. Hãy viết code như thể một Senior Dev khác sẽ đọc.
- Ưu tiên readability over cleverness.
- Comment giải thích WHY, không phải WHAT.
- Nếu có trade-off nào, hãy giải thích cho tôi biết tại sao chọn approach đó.
- Viết tests cho mọi service function TRƯỚC hoặc CÙNG LÚC khi viết implementation.
- Không over-engineer: nếu PostgreSQL FTS đủ tốt, không cần Meilisearch. Nếu BullMQ đủ, không cần thêm queue system.
