# Blog Platform — Monorepo

Professional multi-author blogging platform with subscriptions, newsletter, and analytics.

## Project Structure

```
apps/
  web/        → Public blog (Next.js 16, App Router, Turbopack)
  admin/      → Admin dashboard (Next.js 16)
  api/        → REST API (Hono.js + @hono/zod-openapi)
packages/
  database/   → Drizzle ORM schema, migrations, seed
  shared/     → Shared types, utils, constants
  ui/         → Shared UI components (shadcn/ui)
  validators/ → Zod schemas (shared between API + frontend)
  api-client/ → Typed API client (web, admin, future mobile)
  email-templates/ → React Email templates
  config-typescript/ → Shared tsconfig
  config-eslint/     → Shared ESLint config
tooling/
  docker/     → Dockerfiles + compose
  scripts/    → DB seed, migration, backup scripts
```

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 16 (Turbopack default, `proxy.ts` NOT middleware.ts, `use cache` directive)
- **Backend:** Hono.js + @hono/zod-openapi → auto-generated OpenAPI spec at /api/docs
- **Database:** PostgreSQL 16 + Drizzle ORM (UUID v7, soft delete, tsvector FTS)
- **Cache + Queue:** Redis (shared) — BullMQ for background jobs
- **Auth:** Better Auth (session for web + bearer plugin for mobile-ready)
- **Payment:** Stripe (Phase 3+)
- **Storage:** S3-compatible (Cloudflare R2)
- **Email:** React Email + Resend
- **Search:** PostgreSQL Full-Text Search (MVP) → Meilisearch (Phase 5+ optional)
- **Styling:** Tailwind CSS v4 + shadcn/ui

## Common Commands

```bash
# Install
pnpm install

# Dev (starts all apps + docker services)
docker compose up -d          # PostgreSQL + Redis
pnpm dev                      # Turborepo: all apps in parallel

# Database
pnpm --filter database db:generate   # Generate migration from schema changes
pnpm --filter database db:migrate    # Run migrations
pnpm --filter database db:seed       # Seed dev data
pnpm --filter database db:studio     # Drizzle Studio GUI

# Test
pnpm --filter api test               # Run API tests (Vitest)
pnpm --filter api test:watch         # Watch mode
pnpm test                            # All tests across monorepo

# Build
pnpm build                           # Turborepo: build all
pnpm typecheck                       # TypeScript check all packages

# Lint
pnpm lint                            # ESLint all packages
```

## Critical Rules

- **Next.js 16:** Use `proxy.ts`, NOT `middleware.ts`. Use `use cache` directive, NOT experimental PPR. Turbopack is default — NO webpack config.
- **Editor output:** Tiptap outputs HTML (`content` column) + ProseMirror JSON (`content_json` column). NOT MDX.
- **API format:** All responses: `{ success, data, error, meta }`. Use @hono/zod-openapi `createRoute()` for every route.
- **Auth dual mode:** Better Auth `bearer()` plugin enabled. API middleware checks BOTH cookie (web) AND Authorization header (mobile).
- **Search MVP:** Use PostgreSQL `tsvector` + GIN index. Do NOT install Meilisearch.
- **Background jobs:** BullMQ for: scheduled post publishing, email sending, image optimization, search indexing. NEVER do these synchronously in API handlers.
- **Schema:** Single `public` schema with prefix naming (`billing_subscriptions`, `analytics_page_views`). No multi-schema.
- **IDs:** UUID v7 for all primary keys.
- **Validation:** Zod schemas in `packages/validators/`, shared between API + frontend. Never duplicate validation.
- **TypeScript:** Strict mode, no `any` type.
- **Imports:** ES modules only.

## Code Style

- JSDoc comments explain WHY, not WHAT
- Separate concerns: Route → Service → Repository (Drizzle queries)
- Custom `AppError` class with error codes for all errors
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Every service function MUST have a corresponding test
- Prefer readability over cleverness

## Testing

- Framework: Vitest
- API tests: Hono test client (`app.request()`)
- Test DB: `blog_platform_test` on port 5433, migrate + truncate per suite
- Mock external services (Stripe, Resend, S3) with `vi.mock`
- Run single test files, not full suite, during development

## Workflow

<important>
READ `docs/SPEC.md` before starting any work. It contains the complete specification:
database schema, API endpoints, subscription model, features, caching strategy,
BullMQ job design, backup plan, and testing requirements.
</important>

<important>
MVP SCOPE: Only implement Phase 1 (Foundation) + Phase 2 (Core Content).
STOP after Phase 2 and wait for my review before proceeding.
Phase plan is in `docs/SPEC.md` Section 14.
</important>

### Phase 1 — Foundation
1. Monorepo setup (Turborepo + pnpm)
2. Shared packages (tsconfig, eslint, validators, shared types)
3. Database package (Drizzle schema + migrations)
4. Docker Compose (PostgreSQL + Redis only)
5. API scaffolding (Hono + zod-openapi + middleware + health check)
6. OpenAPI spec + Scalar docs UI at /api/docs
7. Auth (Better Auth: session + bearer plugin)
8. api-client package
9. BullMQ setup (queues, workers, cron)
10. Seed data script
11. Test infrastructure (Vitest + test DB + CI)

### Phase 2 — Core Content (MVP)
1. Posts CRUD API + service + tests
2. Categories & Tags API + tests
3. Media upload (S3 + image optimization via BullMQ)
4. Blog frontend (listing + detail, Next.js 16 `use cache`)
5. Blog editor (Tiptap, output HTML + JSON)
6. Draft/Publish/Schedule (BullMQ cron for scheduled posts)
7. Revision system
8. Comments API + frontend + tests
9. Search (PostgreSQL FTS)
10. SEO basics (sitemap, RSS, structured data, OG tags)

**⛔ STOP HERE. Wait for review.**

## Before You Start

Do NOT code immediately. First:
1. Read `docs/SPEC.md` thoroughly
2. Summarize your understanding (tech stack, MVP scope, phase plan)
3. List all major dependencies with version numbers
4. Raise any concerns or questions
5. Wait for my "Go" before writing any code
