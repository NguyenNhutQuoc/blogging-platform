#!/usr/bin/env bash
#
# Off-site PostgreSQL backup → S3, with retention pruning.
#
# Takes a compressed custom-format dump (pg_dump -Fc, restorable with
# pg_restore) and uploads it to an S3/R2 bucket. Intended to run daily from
# host cron or CI (the SPEC calls for 02:00 UTC, 30-day retention):
#
#   0 2 * * *  cd /opt/blog && set -a && . .env.production && set +a && \
#              tooling/scripts/backup-db.sh >> /var/log/blog-backup.log 2>&1
#
# Required env:
#   DATABASE_URL        postgres connection string (postgres://user:pass@host/db)
#   BACKUP_S3_BUCKET    destination, e.g. s3://blog-db-backups
# Optional env:
#   BACKUP_RETENTION_DAYS   default 30
#   AWS_*/S3_* / aws cli profile for credentials and custom endpoint
#   S3_ENDPOINT             custom endpoint (e.g. Cloudflare R2) → passed as --endpoint-url
#
# Prereqs in the runtime: pg_dump (postgresql-client) and the aws cli.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET must be set (e.g. s3://blog-db-backups)}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Optional custom S3 endpoint (Cloudflare R2, MinIO, …)
AWS_ENDPOINT_ARGS=()
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  AWS_ENDPOINT_ARGS=(--endpoint-url "$S3_ENDPOINT")
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="$(mktemp -t blog_db_XXXXXX).dump"
OBJECT_NAME="blog_platform_${TIMESTAMP}.dump"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "[backup] $(date -u) — dumping database…"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP_FILE" "$DATABASE_URL"

DUMP_BYTES="$(wc -c < "$DUMP_FILE" | tr -d ' ')"
echo "[backup] dump complete: ${DUMP_BYTES} bytes"
if [[ "$DUMP_BYTES" -lt 1024 ]]; then
  echo "[backup] ERROR: dump suspiciously small (<1KB) — aborting before upload." >&2
  exit 1
fi

echo "[backup] uploading to ${BACKUP_S3_BUCKET}/${OBJECT_NAME}…"
aws "${AWS_ENDPOINT_ARGS[@]}" s3 cp "$DUMP_FILE" "${BACKUP_S3_BUCKET}/${OBJECT_NAME}"

# ── Retention: delete dumps older than RETENTION_DAYS ────────────────────────
# Prefer an S3 lifecycle policy in production; this in-script prune is a safe
# fallback for buckets without one.
echo "[backup] pruning backups older than ${RETENTION_DAYS} days…"
CUTOFF_EPOCH="$(date -u -d "-${RETENTION_DAYS} days" +%s 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%s)"

aws "${AWS_ENDPOINT_ARGS[@]}" s3 ls "${BACKUP_S3_BUCKET}/" | while read -r line; do
  file_date="$(echo "$line" | awk '{print $1}')"
  file_name="$(echo "$line" | awk '{print $4}')"
  [[ -z "$file_name" ]] && continue
  file_epoch="$(date -u -d "$file_date" +%s 2>/dev/null || date -u -jf "%Y-%m-%d" "$file_date" +%s 2>/dev/null || echo 0)"
  if [[ "$file_epoch" -gt 0 && "$file_epoch" -lt "$CUTOFF_EPOCH" ]]; then
    echo "[backup]   deleting old backup: $file_name"
    aws "${AWS_ENDPOINT_ARGS[@]}" s3 rm "${BACKUP_S3_BUCKET}/${file_name}"
  fi
done

echo "[backup] ✅ done: ${OBJECT_NAME}"
