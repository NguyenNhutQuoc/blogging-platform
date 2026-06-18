# Deployment & Operations

Production runbook for the Blog Platform (Phase 6). Covers container builds,
configuration, database migrations, caching, backups/restore, monitoring,
CI/CD, and load testing.

---

## 1. Architecture

The production stack runs as separate containers so each tier scales
independently:

```
                    ┌─────────┐        ┌──────────┐
  internet ──▶ web  │ :3000   │──┐     │ postgres │◀─┐
             admin  │ :3002   │  ├─▶ api│ :3003    │  │
                    └─────────┘  │     └──────────┘  │
                                 │     ┌──────────┐  │
                              worker ──│  redis   │──┘
                                       └──────────┘
  migrate (one-shot, runs before api/worker)
  db-backup (scheduled pg_dump)
```

| Service   | Image / Dockerfile                | Command              | Port |
| --------- | --------------------------------- | -------------------- | ---- |
| api       | `tooling/docker/Dockerfile.api`   | `node dist/index.js` | 3003 |
| worker    | same image as api                 | `node dist/worker.js`| —    |
| migrate   | same image as api (one-shot)      | `node dist/migrate.js`| —   |
| web       | `tooling/docker/Dockerfile.web`   | `node apps/web/server.js`   | 3000 |
| admin     | `tooling/docker/Dockerfile.admin` | `node apps/admin/server.js` | 3002 |
| postgres  | `postgres:16-alpine`              | —                    | 5432 |
| redis     | `redis:7-alpine` (appendonly)     | —                    | 6379 |
| db-backup | `prodrigestivill/postgres-backup-local` | scheduled      | —    |

**Build internals (why it works):**

- The API is bundled with `tsup`. Workspace packages (`@repo/*`) export raw
  TypeScript and have no build step, so they are **bundled** into the output;
  only real npm dependencies stay external and are installed via
  `pnpm deploy --prod --legacy`. The API/worker/migrate share one image and one
  bundle — the container command selects the entry point.
- `web` and `admin` use Next.js `output: "standalone"` with
  `outputFileTracingRoot` set to the monorepo root, producing a minimal,
  self-contained server bundle.

---

## 2. Configuration

All secrets live in `.env.production` (git-ignored). Start from the template:

```bash
cp .env.production.example .env.production
# then fill in real secrets — generate strong ones:
openssl rand -base64 48   # BETTER_AUTH_SECRET
openssl rand -hex 32      # ANALYTICS_SALT / POSTGRES_PASSWORD
```

The API **fails fast on boot** in production if `DATABASE_URL` is missing or
`BETTER_AUTH_SECRET` is unset / shorter than 32 chars / still the dev default
(see `apps/api/src/lib/env.ts`). It also warns on a localhost-only
`CORS_ORIGINS` or a default `ANALYTICS_SALT`.

`NEXT_PUBLIC_*` variables are inlined into the browser bundle at **build time**
and must be supplied as Docker build args (compose and CI do this). The
server-only `API_URL` is supplied at **runtime** (compose points it at the
internal `http://api:3003`).

---

## 3. Build & run

Compose reads `.env.production` for `${VAR}` interpolation **and** injects it
into containers, so pass `--env-file`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Start order is enforced by health checks and dependencies:
`postgres`/`redis` healthy → `migrate` runs to completion → `api`/`worker` start.

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost:3003/api/v1/health | jq
```

For managed infrastructure (RDS, Upstash, etc.), remove the `postgres`/`redis`
services and point `DATABASE_URL` / `REDIS_URL` at the managed endpoints.

---

## 4. Database migrations

Migrations run in their own container (`node dist/migrate.js`) before the API
starts. It uses the drizzle-orm migrator (no `drizzle-kit` in the prod image)
to apply journaled migrations, then applies the idempotent custom FTS migration
(GIN index + tsvector trigger).

Run migrations manually (e.g. after a restore):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
```

---

## 5. Caching strategy

Public read paths are cached in Redis (`apps/api/src/lib/cache.ts`):

- **Posts listing** (`GET /posts`) — serialised payload cached per query, 60s TTL.
- **Post detail** (`GET /posts/{slug}`) — cached for `free` + `published` posts
  only (5 min). `pro`/`premium` responses are viewer-dependent and never cached.

Rules enforced by the helper:

- Only JSON-safe, already-serialised payloads are cached (never raw DB rows —
  a JSON round-trip would corrupt `Date` fields).
- Cache is best-effort: a Redis outage falls through to the database; it never
  fails a request.
- Disabled under `NODE_ENV=test` for deterministic tests.
- Every post mutation (create/update/delete/publish/schedule) **and** the
  scheduled-publish worker call `invalidatePostCache()`, clearing the
  `cache:posts:*` namespace immediately.

Redis is also the BullMQ broker and rate-limit store. It runs with `appendonly`
so queued jobs survive restarts; cached data rebuilds itself on demand.

---

## 6. Backups & disaster recovery

### Backups

- **In-cluster (local + retention):** the `db-backup` service takes scheduled
  `pg_dump`s to the `./backups` volume (30 days / 4 weeks / 6 months).
- **Off-site (S3/R2):** `tooling/scripts/backup-db.sh` dumps (`pg_dump -Fc`) and
  uploads to S3 with retention pruning. Run daily from host cron:

  ```cron
  0 2 * * * cd /opt/blog && set -a && . .env.production && set +a && \
            tooling/scripts/backup-db.sh >> /var/log/blog-backup.log 2>&1
  ```

  Prefer an S3 lifecycle policy for retention; the script's prune is a fallback.
- **Media (S3/R2):** enable bucket versioning; cross-region replication optional.
- **Redis:** ephemeral — not backed up. Cache rebuilds; jobs re-enqueue.

### Recovery procedure

1. Provision a fresh PostgreSQL instance and set `DATABASE_URL`.
2. Restore the latest dump:
   ```bash
   DATABASE_URL=… tooling/scripts/restore-db.sh s3://blog-db-backups/blog_platform_<ts>.dump
   ```
3. Start Redis (cache rebuilds, jobs re-enqueue automatically).
4. Verify S3/R2 media is reachable.
5. Apply any pending migrations (`run --rm migrate`).
6. Bring up `api`/`worker`/`web`/`admin` and confirm
   `GET /api/v1/health` returns `status: "ok"`.

---

## 7. Error monitoring (Sentry-ready)

Monitoring hooks are wired in but dependency-free
(`apps/api/src/lib/observability.ts`):

- Unhandled API errors (500s) are reported with request path/method.
- The worker installs `unhandledRejection` / `uncaughtException` guards.

It is a **no-op** until you enable it:

```bash
pnpm --filter @repo/api add @sentry/node
# set SENTRY_DSN in .env.production
```

With no DSN (or the package absent), all reporting calls are silent no-ops.

---

## 8. CI/CD

- **`ci.yml`** (PRs + pushes to `main`/`develop`): install → typecheck → lint →
  migrate test DB → test → build. This gates merges.
- **`deploy.yml`** (push to `main`, `v*` tags, manual): builds and pushes the
  `api`, `web`, and `admin` images to GHCR (`ghcr.io/<repo>/<app>`) with
  branch/SHA/semver tags and layer caching. Set repo **variables**
  `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_ADMIN_URL` for the web/admin build args.

Cut a release:

```bash
git tag v1.0.0 && git push origin v1.0.0   # → images tagged 1.0.0, 1.0, 1
```

---

## 9. Load testing

[k6](https://k6.io) script at `tooling/scripts/load-test.js` exercises health,
posts listing, post detail, and search:

```bash
BASE_URL=https://api.example.com k6 run tooling/scripts/load-test.js
```

Thresholds (fail the run on regression): `<1%` errors, `p95 < 500ms`. Tune
`SLUG` / `SEARCH_TERM` to match seeded data.

---

## 10. Scaling notes

- **API**: stateless — scale horizontally behind a load balancer.
- **Worker**: scale independently; BullMQ distributes jobs across instances.
  Crons are idempotent (safe with multiple workers).
- **web/admin**: stateless Next.js servers — scale horizontally; front with a CDN.
- **PostgreSQL**: the bottleneck — use a managed instance with read replicas and
  connection pooling (PgBouncer) before scaling app tiers further.
- **Redis**: single shared instance for cache + queue + rate limiting; move to a
  managed/HA Redis as load grows.
