#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
ATTACHMENTS_SOURCE="${ATTACHMENTS_SOURCE:-/attachments}"
BACKUP_INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

case "$BACKUP_DIR" in
  /backups|/backups/*) ;;
  *) echo '{"level":"error","event":"backup.invalid_directory"}' >&2; exit 1 ;;
esac

case "$BACKUP_INTERVAL_HOURS:$BACKUP_RETENTION_DAYS" in
  *[!0-9:]*|:*|*:) echo '{"level":"error","event":"backup.invalid_retention_configuration"}' >&2; exit 1 ;;
esac
if [ "$BACKUP_INTERVAL_HOURS" -lt 1 ] || [ "$BACKUP_RETENTION_DAYS" -lt 1 ]; then
  echo '{"level":"error","event":"backup.invalid_retention_configuration"}' >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077

json_log() {
  level="$1"
  event="$2"
  detail="${3:-}"
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ -n "$detail" ]; then
    printf '{"timestamp":"%s","level":"%s","service":"backup","event":"%s","detail":"%s"}\n' "$timestamp" "$level" "$event" "$detail"
  else
    printf '{"timestamp":"%s","level":"%s","service":"backup","event":"%s"}\n' "$timestamp" "$level" "$event"
  fi
}

create_backup() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  final_dir="$BACKUP_DIR/backup-$timestamp"
  temporary_dir="$BACKUP_DIR/.backup-$timestamp.tmp"
  rm -rf -- "$temporary_dir"
  mkdir -p "$temporary_dir"

  cleanup_temporary() {
    rm -rf -- "$temporary_dir"
  }
  trap cleanup_temporary INT TERM HUP

  json_log info backup.started "$timestamp"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    --host="${PGHOST:-postgres}" \
    --port="${PGPORT:-5432}" \
    --username="${POSTGRES_USER:-postgres}" \
    --dbname="${POSTGRES_DB:-ax_finance}" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --file="$temporary_dir/database.dump" || {
      cleanup_temporary
      return 1
    }

  tar -czf "$temporary_dir/attachments.tar.gz" \
    --exclude='./.coordination' \
    -C "$ATTACHMENTS_SOURCE" . || {
      cleanup_temporary
      return 1
    }

  database_bytes="$(wc -c < "$temporary_dir/database.dump" | tr -d ' ')"
  attachment_bytes="$(wc -c < "$temporary_dir/attachments.tar.gz" | tr -d ' ')"
  attachment_count="$(find "$ATTACHMENTS_SOURCE" -type f ! -path '*/.coordination/*' | wc -l | tr -d ' ')"
  created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"formatVersion":1,"createdAt":"%s","databaseBytes":%s,"attachmentsArchiveBytes":%s,"attachmentFileCount":%s}\n' \
    "$created_at" "$database_bytes" "$attachment_bytes" "$attachment_count" > "$temporary_dir/metadata.json"

  (
    cd "$temporary_dir"
    sha256sum database.dump attachments.tar.gz metadata.json > SHA256SUMS
    sha256sum -c SHA256SUMS >/dev/null
  ) || {
    cleanup_temporary
    return 1
  }

  mv "$temporary_dir" "$final_dir" || {
    cleanup_temporary
    return 1
  }
  success_epoch="$(date +%s)"
  printf '%s\n%s\n' "$success_epoch" "$(basename "$final_dir")" > "$BACKUP_DIR/.last_success.tmp"
  mv "$BACKUP_DIR/.last_success.tmp" "$BACKUP_DIR/.last_success"

  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' \
    -mtime "+$BACKUP_RETENTION_DAYS" -exec rm -rf -- {} \;
  trap - INT TERM HUP
  json_log info backup.completed "$(basename "$final_dir")"
}

while true; do
  if ! create_backup; then
    trap - INT TERM HUP
    json_log error backup.failed
    # BACKUP_ONCE=1: um único backup e sai (usado pela verificação de restauração no CI).
    if [ "${BACKUP_ONCE:-}" = "1" ]; then exit 1; fi
    sleep 300 &
    wait $!
    continue
  fi
  if [ "${BACKUP_ONCE:-}" = "1" ]; then exit 0; fi
  sleep "$((BACKUP_INTERVAL_HOURS * 3600))" &
  wait $!
done
