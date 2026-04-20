# Blog Platform — Developer Guide

Monorepo cho một nền tảng blog đa tác giả, bao gồm REST API, public blog và admin dashboard.

---

## Mục lục

- [Tổng quan kiến trúc](#tổng-quan-kiến-trúc)
- [Tech stack](#tech-stack)
- [Cài đặt môi trường](#cài-đặt-môi-trường)
- [Chạy project](#chạy-project)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tạo một feature mới — từ A đến Z](#tạo-một-feature-mới--từ-a-đến-z)
- [Viết test](#viết-test)
- [Quy ước code](#quy-ước-code)
- [Các câu hỏi thường gặp](#các-câu-hỏi-thường-gặp)

---

## Tổng quan kiến trúc

```
Browser (web :3000)          Browser (admin :3002)
        │                              │
        │  /api/* proxy                │  /api/* proxy
        ▼                              ▼
   apps/web (Next.js)          apps/admin (Next.js)
        │                              │
        └──────────┬───────────────────┘
                   │ HTTP
                   ▼
           apps/api (Hono :3003)
                   │
          ┌────────┴────────┐
          ▼                 ▼
   PostgreSQL 16         Redis 7
   (Drizzle ORM)         (BullMQ)
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              Email Worker        Image Worker
              (Resend)            (Sharp + S3)
```

- **`apps/api`** là nơi toàn bộ business logic sống. Web và Admin không gọi DB trực tiếp — mọi thứ đều qua API.
- **`apps/web`** và **`apps/admin`** dùng `proxy.ts` để forward `/api/*` đến API service (không dùng `middleware.ts`).
- **Background jobs** (gửi email, optimize ảnh, …) chạy qua BullMQ + Redis, **không bao giờ** xử lý đồng bộ trong request handler.

---

## Tech stack

| Lớp        | Công nghệ                                       |
| ---------- | ----------------------------------------------- |
| Monorepo   | Turborepo + pnpm workspaces                     |
| API        | Hono.js + `@hono/zod-openapi`                   |
| Frontend   | Next.js 15 (Turbopack, App Router)              |
| Database   | PostgreSQL 16 + Drizzle ORM                     |
| Queue      | Redis 7 + BullMQ                                |
| Auth       | Better Auth (session cookie + Bearer token)     |
| Storage    | S3-compatible (MinIO local, Cloudflare R2 prod) |
| Email      | React Email + Resend                            |
| Editor     | Tiptap (ProseMirror)                            |
| UI         | shadcn/ui + Tailwind CSS v4                     |
| Validation | Zod (shared giữa API và frontend)               |
| Test       | Vitest                                          |

---

## Cài đặt môi trường

### Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 10
- Docker & Docker Compose

### Bước 1 — Clone và cài dependencies

```bash
git clone <repo-url>
cd blogging-platform
pnpm install
```

### Bước 2 — Tạo file `.env`

```bash
cp .env.example .env
```

Các biến bắt buộc phải có trong `.env` để chạy được:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blog_platform
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/blog_platform_test

# Redis
REDIS_URL=redis://localhost:6379

# Auth — tạo bằng: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-here

# S3 / MinIO (dùng mặc định khi dev local)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=blog-media
S3_REGION=us-east-1

# App URLs
APP_URL=http://localhost:3000
API_URL=http://localhost:3003
ADMIN_URL=http://localhost:3002
```

> **Resend / Stripe / OAuth** không bắt buộc để dev local. Để trống thì email sẽ được log ra console thay vì gửi thật.

### Bước 3 — Khởi động Docker services

```bash
docker compose up -d
```

Lệnh này khởi động:

- PostgreSQL 16 trên cổng `5432` (dev) và `5433` (test)
- Redis 7 trên cổng `6379`
- MinIO (S3) trên cổng `9000` (API) và `9001` (UI)

### Bước 4 — Chạy database migrations và seed

```bash
pnpm --filter database db:migrate   # Tạo bảng từ schema
pnpm --filter database db:seed      # Seed dữ liệu mẫu
```

---

## Chạy project

```bash
# Khởi động tất cả apps cùng lúc (hot reload)
pnpm dev
```

| App         | URL                            | Mô tả                |
| ----------- | ------------------------------ | -------------------- |
| Public Blog | http://localhost:3000          | Frontend cho độc giả |
| API         | http://localhost:3003          | REST API             |
| API Docs    | http://localhost:3003/api/docs | Swagger UI (Scalar)  |
| Admin       | http://localhost:3002          | Dashboard quản trị   |
| MinIO UI    | http://localhost:9001          | Quản lý file storage |

### Chạy riêng từng app

```bash
pnpm --filter @repo/api dev
pnpm --filter @repo/web dev
pnpm --filter @repo/admin dev
```

### Các lệnh hay dùng

```bash
pnpm typecheck                       # Kiểm tra TypeScript toàn monorepo
pnpm lint                            # ESLint toàn monorepo
pnpm test                            # Chạy tất cả tests
pnpm --filter @repo/api test:watch   # Watch mode cho API tests
pnpm --filter database db:studio     # Mở Drizzle Studio (xem DB qua UI)
pnpm --filter database db:generate   # Tạo migration mới từ thay đổi schema
```

---

## Cấu trúc thư mục

```
blogging-platform/
├── apps/
│   ├── api/                    ← REST API (Hono.js)
│   │   └── src/
│   │       ├── app.ts          ← Đăng ký tất cả routes
│   │       ├── index.ts        ← Entry point (khởi động server)
│   │       ├── middleware/     ← auth, cors, error-handler
│   │       ├── routes/v1/      ← Route handlers (HTTP layer)
│   │       ├── services/       ← Business logic
│   │       ├── repositories/   ← Drizzle queries (DB layer)
│   │       ├── jobs/
│   │       │   ├── queues.ts   ← BullMQ queue definitions
│   │       │   └── workers/    ← Job processors
│   │       └── tests/          ← Vitest integration tests
│   ├── web/                    ← Public blog (Next.js)
│   └── admin/                  ← Admin dashboard (Next.js)
│
├── packages/
│   ├── database/               ← Drizzle schema, migrations, seed
│   │   └── src/schema/         ← auth.ts, content.ts, billing.ts, …
│   ├── shared/                 ← Types, utils, constants dùng chung
│   ├── validators/             ← Zod schemas (dùng ở cả API lẫn frontend)
│   ├── api-client/             ← Typed HTTP client cho frontend
│   ├── ui/                     ← React component library (shadcn/ui)
│   └── email-templates/        ← React Email templates
│
└── tooling/
    ├── docker/                 ← Dockerfiles production
    └── scripts/                ← DB backup, migration helpers
```

---

## Tạo một feature mới — từ A đến Z

> **Ví dụ thực tế:** Thêm tính năng **"Reactions"** cho bài viết (like, love, insightful).

Mỗi feature API mới đều đi theo đúng một luồng:

```
Validator (Zod) → Repository (DB) → Service (logic) → Route (HTTP) → mount vào app.ts
```

---

### Bước 1 — Định nghĩa Zod schema trong `packages/validators`

Tạo file `packages/validators/src/reaction.ts`:

```typescript
import { z } from "zod";

export const createReactionSchema = z.object({
  type: z.enum(["like", "love", "insightful", "bookmark"]),
});

export type CreateReactionInput = z.infer<typeof createReactionSchema>;
```

Export ra `packages/validators/src/index.ts`:

```typescript
export * from "./reaction.js";
```

> **Tại sao?** Schema Zod được dùng ở cả API (validate request) lẫn frontend (validate form). Định nghĩa một lần, dùng ở nhiều nơi.

---

### Bước 2 — Viết Repository (Drizzle queries) trong `apps/api/src/repositories`

Tạo file `apps/api/src/repositories/reactions.ts`:

```typescript
import { db } from "../lib/db.js";
import { postReactions } from "@repo/database";
import { and, eq, count } from "drizzle-orm";

/** Thêm hoặc cập nhật reaction của user cho một bài viết */
export async function upsertReaction(
  postId: string,
  userId: string,
  type: string,
) {
  // Xóa reaction cũ nếu tồn tại, rồi insert mới
  await db
    .delete(postReactions)
    .where(
      and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)),
    );

  const [reaction] = await db
    .insert(postReactions)
    .values({ postId, userId, reactionType: type })
    .returning();

  return reaction;
}

/** Đếm reactions theo từng loại cho một bài viết */
export async function countReactionsByPost(postId: string) {
  return db
    .select({ type: postReactions.reactionType, count: count() })
    .from(postReactions)
    .where(eq(postReactions.postId, postId))
    .groupBy(postReactions.reactionType);
}
```

> **Quy tắc:** Repository chỉ chứa Drizzle queries. Không có business logic ở đây.

---

### Bước 3 — Viết Service (business logic) trong `apps/api/src/services`

Tạo file `apps/api/src/services/reactions.ts`:

```typescript
import { AppError } from "../lib/errors.js";
import * as reactionsRepo from "../repositories/reactions.js";
import * as postsRepo from "../repositories/posts.js";
import type { CreateReactionInput } from "@repo/validators";

export async function addReaction(
  postId: string,
  userId: string,
  input: CreateReactionInput,
) {
  // Kiểm tra bài viết tồn tại và đã published
  const post = await postsRepo.findPostById(postId);
  if (!post) throw new AppError("POST_NOT_FOUND", "Post not found", 404);
  if (post.status !== "published") {
    throw new AppError(
      "POST_NOT_PUBLISHED",
      "Cannot react to unpublished post",
      400,
    );
  }

  return reactionsRepo.upsertReaction(postId, userId, input.type);
}

export async function getReactions(postId: string) {
  return reactionsRepo.countReactionsByPost(postId);
}
```

> **Quy tắc:** Service chứa business logic và validation nghiệp vụ. Service gọi Repository, không gọi DB trực tiếp.

---

### Bước 4 — Viết Route Handler trong `apps/api/src/routes/v1`

Tạo file `apps/api/src/routes/v1/reactions.ts`:

```typescript
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth.js";
import * as reactionsService from "../../services/reactions.js";
import { createReactionSchema } from "@repo/validators";
import type { AuthUser } from "../../lib/auth.js";

// Bắt buộc phải khai báo Env để c.get("user") có type đúng
type Env = { Variables: { user: AuthUser; session: Record<string, unknown> } };
const router = new OpenAPIHono<Env>();

// --- GET /posts/:postId/reactions ---
router.openapi(
  createRoute({
    method: "get",
    path: "/posts/{postId}/reactions",
    tags: ["Reactions"],
    request: {
      params: z.object({ postId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Reaction counts by type",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              data: z.array(z.object({ type: z.string(), count: z.number() })),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { postId } = c.req.valid("param");
    const data = await reactionsService.getReactions(postId);
    return c.json({ success: true as const, data });
  },
);

// --- POST /posts/:postId/reactions ---
router.openapi(
  createRoute({
    method: "post",
    path: "/posts/{postId}/reactions",
    tags: ["Reactions"],
    middleware: [requireAuth] as const, // as const bắt buộc!
    request: {
      params: z.object({ postId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: createReactionSchema } },
      },
    },
    responses: {
      201: {
        description: "Reaction added",
        content: {
          "application/json": {
            schema: z.object({ success: z.literal(true), data: z.unknown() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const user = c.get("user"); // typed vì có Env generic
    const { postId } = c.req.valid("param");
    const body = c.req.valid("json");
    const data = await reactionsService.addReaction(postId, user.id, body);
    return c.json({ success: true as const, data }, 201);
  },
);

export const reactionsRouter = router;
```

> **Quan trọng:**
>
> - Chỉ khai báo response 2xx trong `createRoute()`. Lỗi thì throw `AppError` — global error handler sẽ bắt.
> - `middleware: [requireAuth] as const` — thiếu `as const` sẽ bị TypeScript error.
> - `new OpenAPIHono<Env>()` — luôn truyền Env generic để `c.get("user")` có type đúng.

---

### Bước 5 — Mount router vào `apps/api/src/app.ts`

```typescript
// app.ts
import { reactionsRouter } from "./routes/v1/reactions.js";

// Thêm vào sau các router khác
app.route("/api/v1", reactionsRouter);
```

✅ **Xong!** Giờ `GET /api/v1/posts/:postId/reactions` và `POST /api/v1/posts/:postId/reactions` đã hoạt động và tự động xuất hiện trong Swagger UI tại http://localhost:3003/api/docs.

---

### Bổ sung: Nếu feature cần background job

Ví dụ: gửi notification email khi có reaction.

**1. Enqueue job trong service:**

```typescript
// services/reactions.ts
import { emailQueue } from "../jobs/queues.js";

export async function addReaction(...) {
  const reaction = await reactionsRepo.upsertReaction(...);

  // Đẩy job vào queue, KHÔNG await để không block response
  await emailQueue.add("reaction-notification", {
    template: "reaction-notification",
    to: post.author.email,
    props: { postTitle: post.title, reactionType: input.type },
  });

  return reaction;
}
```

**2. Xử lý job trong worker (`apps/api/src/jobs/workers/email.worker.ts`):**

```typescript
// Thêm case mới vào switch trong buildEmail()
case "reaction-notification":
  return React.createElement(ReactionNotificationEmail, data.props);
```

> **Tuyệt đối không** xử lý email/ảnh/nặng trực tiếp trong route handler. Luôn dùng queue.

---

### Bổ sung: Nếu feature cần schema DB mới

**1. Chỉnh sửa schema trong `packages/database/src/schema/`:**

```typescript
// packages/database/src/schema/content.ts
// (postReactions đã có sẵn — chỉ ví dụ nếu cần thêm bảng mới)
export const newTable = pgTable("new_table", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // ...
});
```

**2. Tạo migration:**

```bash
pnpm --filter database db:generate   # Drizzle đọc schema và tạo file SQL
pnpm --filter database db:migrate    # Chạy migration
```

**3. Export type mới trong `packages/database/src/index.ts`:**

```typescript
export type NewTableRow = typeof newTable.$inferSelect;
```

---

### Bổ sung: Nếu cần dùng feature trên frontend

**1. Thêm method vào `packages/api-client/src/resources/`:**

```typescript
// packages/api-client/src/resources/reactions.ts
export class ReactionsResource {
  constructor(private client: ApiClient) {}

  async getReactions(postId: string) {
    return this.client.get<Array<{ type: string; count: number }>>(
      `/api/v1/posts/${postId}/reactions`,
    );
  }

  async addReaction(postId: string, type: string) {
    return this.client.post(`/api/v1/posts/${postId}/reactions`, { type });
  }
}
```

**2. Đăng ký vào factory trong `packages/api-client/src/index.ts`:**

```typescript
export function createApiClient(
  baseUrl: string,
  getToken?: () => string | null,
) {
  const client = new ApiClient({ baseUrl, getToken });
  return {
    posts: new PostsResource(client),
    reactions: new ReactionsResource(client), // ← thêm vào đây
    // ...
  };
}
```

**3. Dùng trong Next.js page:**

```typescript
// apps/web/src/app/[slug]/page.tsx
const reactions = await api.reactions.getReactions(post.id);
```

---

## Viết test

Tests cho API nằm ở `apps/api/src/tests/`. Mỗi domain có một file riêng.

### Chạy test

```bash
pnpm --filter @repo/api test          # Chạy một lần
pnpm --filter @repo/api test:watch    # Watch mode khi đang dev
```

> Cần Docker đang chạy để có test DB (port 5433).

### Cấu trúc một test file

```typescript
// apps/api/src/tests/reactions.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { createTestUser, createTestPost } from "./helpers.js";

// Mock queue để test không cần Redis thật
vi.mock("../jobs/queues.js", () => ({
  emailQueue: { add: vi.fn() },
  imageQueue: { add: vi.fn() },
  searchIndexQueue: { add: vi.fn() },
  analyticsQueue: { add: vi.fn() },
}));

// Mock Better Auth để kiểm soát user đăng nhập
const mockGetSession = vi.fn();
vi.mock("../lib/auth.js", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

describe("Reactions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/posts/:id/reactions — trả về mảng rỗng khi chưa có", async () => {
    const post = await createTestPost({ status: "published" });

    const res = await app.request(`/api/v1/posts/${post.id}/reactions`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("POST /api/v1/posts/:id/reactions — yêu cầu đăng nhập", async () => {
    mockGetSession.mockResolvedValueOnce(null); // chưa đăng nhập
    const post = await createTestPost({ status: "published" });

    const res = await app.request(`/api/v1/posts/${post.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "like" }),
    });

    expect(res.status).toBe(401);
  });

  it("POST — thêm reaction thành công", async () => {
    const user = await createTestUser();
    mockGetSession.mockResolvedValueOnce({ user, session: { id: "s1" } });
    const post = await createTestPost({ status: "published" });

    const res = await app.request(`/api/v1/posts/${post.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "love" }),
    });

    expect(res.status).toBe(201);
  });
});
```

### Quy tắc test

- Mỗi feature → ít nhất 1 file test riêng
- Mock BullMQ queues và Better Auth ở đầu mỗi file
- Dùng `createTestUser()`, `createTestPost()` từ `helpers.ts` để setup data
- Test cả happy path lẫn error cases (401, 404, 422)
- Không test implementation detail — test behavior

---

## Quy ước code

### Commits

Dùng [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): thêm reactions endpoint
fix(web): sửa lỗi pagination trên trang category
chore(database): thêm index cho bảng reactions
test(api): thêm test cho reactions service
refactor(shared): tách utils thành các module nhỏ hơn
```

### TypeScript

- **Strict mode** — không dùng `any`. Nếu thật sự cần, dùng `unknown` và narrow type.
- Không import trực tiếp từ sub-path package (`@repo/shared/utils/slug`) — phải dùng đúng export path trong `package.json`.
- Tất cả imports từ `.js` extension (ESM).

### API responses

Tất cả responses phải đúng envelope:

```typescript
// ✅ Đúng
return c.json({ success: true as const, data: post }, 200);
return c.json(
  { success: true as const, data: posts, meta: { page, total, totalPages } },
  200,
);

// ❌ Sai — không wrap vào envelope
return c.json(post, 200);
```

### Không làm nặng trong request handler

```typescript
// ❌ Sai — block request để gửi email
await sendEmail(user.email, welcomeTemplate);

// ✅ Đúng — đẩy vào queue, return ngay
await emailQueue.add("welcome", { to: user.email, ... });
```

### Soft delete

Không xóa cứng records. Dùng `deletedAt`:

```typescript
// ✅ Đúng
await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));

// ❌ Sai
await db.delete(posts).where(eq(posts.id, id));
```

---

## Các câu hỏi thường gặp

**Tại sao dùng `proxy.ts` mà không phải `middleware.ts`?**

CLAUDE.md yêu cầu rõ: Next.js 16 dùng `proxy.ts` (Route Handler) thay vì `middleware.ts` (Edge Runtime). Lý do: middleware chạy trên Edge, có giới hạn runtime — proxy chạy trên Node.js, hỗ trợ đầy đủ.

---

**Thêm column mới vào bảng có sẵn như thế nào?**

1. Sửa schema trong `packages/database/src/schema/`
2. `pnpm --filter database db:generate` → tạo file migration
3. `pnpm --filter database db:migrate` → chạy migration
4. Cập nhật type export trong `packages/database/src/index.ts` nếu cần

---

**Tại sao routes chỉ khai báo response 2xx trong `createRoute()`?**

`@hono/zod-openapi` yêu cầu return type của handler phải khớp với response schema. Nếu khai báo cả 404, 422, … thì phải union type trong return — rất phức tạp. Giải pháp: chỉ khai báo 2xx, throw `AppError` cho lỗi → global error handler ở `src/middleware/error-handler.ts` bắt và format response.

---

**Tại sao `middleware: [requireAuth] as const`?**

`@hono/zod-openapi` đọc middleware array như một tuple để infer type. Không có `as const`, TypeScript infer thành `Function[]` và mất type — `c.get("user")` sẽ báo lỗi.

---

**Thêm một queue job mới như thế nào?**

1. Định nghĩa job data type trong worker file
2. Enqueue trong service: `await myQueue.add("job-name", data)`
3. Xử lý trong worker: thêm `case` vào switch hoặc viết processor mới
4. Đăng ký worker trong `apps/api/src/jobs/workers/index.ts`

---

**API docs ở đâu khi đang dev?**

Mở http://localhost:3003/api/docs — Scalar UI tự động generate từ tất cả `createRoute()` đã mount.
Spec JSON raw: http://localhost:3003/api/v1/openapi.json

---

**Kiểm tra FTS (full-text search) hoạt động chưa?**

FTS index được cập nhật qua PostgreSQL trigger khi INSERT/UPDATE bài viết. Để test:

```bash
# Kết nối DB
psql postgresql://postgres:postgres@localhost:5432/blog_platform

-- Kiểm tra search vector của một bài
SELECT id, title, search_vector FROM posts LIMIT 1;
```

---

**Drizzle Studio — xem data qua UI?**

```bash
pnpm --filter database db:studio
# Mở http://local.drizzle.studio
```
