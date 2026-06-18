#!/usr/bin/env bash
#
# Restore a PostgreSQL backup produced by backup-db.sh.
#
# Usage:
#   tooling/scripts/restore-db.sh s3://blog-db-backups/blog_platform_20260617T020000Z.dump
#   tooling/scripts/restore-db.sh ./local_backup.dump
#
# Required env:
#   DATABASE_URL   target database connection string (the DB to restore INTO)
# Optional env:
#   S3_ENDPOINT    custom endpoint for S3-hosted backups (R2/MinIO)
#
# ⚠️  This OVERWRITES objects in the target database (pg_restore --clean).
#     Restore into a fresh/empty database or a staging instance first.
set -euo pipefail

SOURCE="${1:-}"
: "${DATABASE_URL:?DATABASE_URL must be set (the target database)}"
if [[ -z "$SOURCE" ]]; then
  echo "Usage: $0 <s3://bucket/key.dump | /path/to/local.dump>" >&2
  exit 1
fi

AWS_ENDPOINT_ARGS=()
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  AWS_ENDPOINT_ARGS=(--endpoint-url "$S3_ENDPOINT")
fi

LOCAL_DUMP="$SOURCE"
CLEANUP=""
if [[ "$SOURCE" == s3://* ]]; then
  LOCAL_DUMP="$(mktemp -t blog_restore_XXXXXX).dump"
  CLEANUP="$LOCAL_DUMP"
  echo "[restore] downloading $SOURCE …"
  aws "${AWS_ENDPOINT_ARGS[@]}" s3 cp "$SOURCE" "$LOCAL_DUMP"
fi
trap '[[ -n "$CLEANUP" ]] && rm -f "$CLEANUP"' EXIT

echo "[restore] confirm: restoring into the database in DATABASE_URL — this is destructive."
read -r -p "[restore] type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "[restore] aborted."; exit 1; }

echo "[restore] running pg_restore…"
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$DATABASE_URL" "$LOCAL_DUMP"

echo "[restore] ✅ restore complete. Next: restart the app and run a health check."
