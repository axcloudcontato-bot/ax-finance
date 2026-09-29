#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-/backups}"
remote="${BACKUP_REMOTE:-}"
interval_hours="${BACKUP_COPY_INTERVAL_HOURS:-24}"

if [ -z "$remote" ]; then
  echo '{"level":"error","event":"backup_copy.remote_missing"}' >&2
  exit 1
fi
case "$interval_hours" in *[!0-9]*|'') echo '{"level":"error","event":"backup_copy.invalid_interval"}' >&2; exit 1 ;; esac
if [ "$interval_hours" -lt 1 ]; then
  echo '{"level":"error","event":"backup_copy.invalid_interval"}' >&2
  exit 1
fi

copy_latest() {
  marker="$backup_dir/.last_success"
  test -f "$marker" || { echo '{"level":"error","event":"backup_copy.marker_missing"}' >&2; return 1; }
  backup_name="$(sed -n '2p' "$marker")"
  case "$backup_name" in
    backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z) ;;
    *) echo '{"level":"error","event":"backup_copy.invalid_backup_name"}' >&2; return 1 ;;
  esac
  source_dir="$backup_dir/$backup_name"
  for required in database.dump attachments.tar.gz metadata.json SHA256SUMS; do
    test -f "$source_dir/$required" || { echo '{"level":"error","event":"backup_copy.incomplete_backup"}' >&2; return 1; }
  done
  (cd "$source_dir" && sha256sum -c SHA256SUMS >/dev/null)
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"timestamp":"%s","level":"info","service":"backup-copy","event":"backup_copy.started","backup":"%s"}\n' "$started_at" "$backup_name"
  rclone copy "$source_dir" "${remote%/}/$backup_name" --checksum --immutable --checkers 4 --transfers 2
  rclone check "$source_dir" "${remote%/}/$backup_name" --checksum --one-way
  completed_epoch="$(date +%s)"
  printf '%s\n%s\n' "$completed_epoch" "$backup_name" >"$backup_dir/.external_copy_success.tmp"
  mv "$backup_dir/.external_copy_success.tmp" "$backup_dir/.external_copy_success"
  printf '{"timestamp":"%s","level":"info","service":"backup-copy","event":"backup_copy.completed","backup":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup_name"
}

while true; do
  copy_latest || true
  sleep "$((interval_hours * 3600))" &
  wait $!
done
