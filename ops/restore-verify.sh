#!/bin/sh
set -eu
started_epoch="$(date +%s)"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
marker="$BACKUP_DIR/.last_success"

if [ ! -f "$marker" ]; then
  echo '{"level":"error","event":"restore_verify.backup_marker_missing"}' >&2
  exit 1
fi

backup_name="$(sed -n '2p' "$marker")"
case "$backup_name" in
  backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z) ;;
  *) echo '{"level":"error","event":"restore_verify.invalid_backup_name"}' >&2; exit 1 ;;
esac

source_dir="$BACKUP_DIR/$backup_name"
for required in database.dump attachments.tar.gz metadata.json SHA256SUMS; do
  test -f "$source_dir/$required" || {
    echo '{"level":"error","event":"restore_verify.incomplete_backup"}' >&2
    exit 1
  }
done

(
  cd "$source_dir"
  sha256sum -c SHA256SUMS
  tar -tzf attachments.tar.gz >/dev/null
)

work_dir="$(mktemp -d /tmp/ax-finance-restore-XXXXXX)"
pgdata="$work_dir/pgdata"
socket_dir="$work_dir/socket"
attachments_dir="$work_dir/attachments"
mkdir -p "$pgdata" "$socket_dir" "$attachments_dir"
# O backup grava os arquivos só para o root (umask 077); o pg_restore roda como postgres, então
# restaura de uma cópia dentro da pasta de trabalho, que pertence ao postgres.
cp "$source_dir/database.dump" "$work_dir/database.dump"
chown -R postgres:postgres "$work_dir"

cleanup() {
  if [ -s "$pgdata/postmaster.pid" ]; then
    su-exec postgres pg_ctl -D "$pgdata" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf -- "$work_dir"
}
trap cleanup EXIT INT TERM HUP

su-exec postgres initdb -D "$pgdata" --auth=trust --no-locale >/dev/null
su-exec postgres pg_ctl -D "$pgdata" -o "-k $socket_dir -p 55432" -w start >/dev/null
su-exec postgres createuser -h "$socket_dir" -p 55432 ax_app
su-exec postgres createdb -h "$socket_dir" -p 55432 restore_verify
su-exec postgres pg_restore \
  --host="$socket_dir" \
  --port=55432 \
  --username=postgres \
  --dbname=restore_verify \
  --exit-on-error \
  --no-owner \
  "$work_dir/database.dump"

tables="$(su-exec postgres psql -h "$socket_dir" -p 55432 -d restore_verify -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"
migrations="$(su-exec postgres psql -h "$socket_dir" -p 55432 -d restore_verify -Atc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
database_attachments="$(su-exec postgres psql -h "$socket_dir" -p 55432 -d restore_verify -Atc \
  "SELECT count(*) FROM attachments;")"
test "$tables" -gt 0 && test "$migrations" -gt 0 || {
  echo '{"level":"error","event":"restore_verify.empty_schema"}' >&2
  exit 1
}
# Um backup do volume local não prova a recuperação de objetos em S3.
remote_attachments="$(su-exec postgres psql -h "$socket_dir" -p 55432 -d restore_verify -Atc \
  "SELECT count(*) FROM attachments WHERE storage_backend <> 'LOCAL';")"
if [ "$remote_attachments" -gt 0 ]; then
  echo '{"level":"error","event":"restore_verify.external_objects_require_verification"}' >&2
  exit 1
fi

tar -xzf "$source_dir/attachments.tar.gz" -C "$attachments_dir"
archive_attachments="$(find "$attachments_dir" -type f ! -path '*/.coordination/*' | wc -l | tr -d ' ')"

su-exec postgres psql -h "$socket_dir" -p 55432 -d restore_verify -At -F '|' -c \
  "SELECT storage_key, sha256, size_bytes FROM attachments ORDER BY storage_key;" > "$work_dir/attachment-inventory"
while IFS='|' read -r storage_key expected_hash expected_size; do
  case "$storage_key" in
    *[!a-f0-9/-]*|*..*)
      echo '{"level":"error","event":"restore_verify.invalid_attachment_key"}' >&2
      exit 1
      ;;
  esac
  test -f "$attachments_dir/$storage_key" || {
    echo '{"level":"error","event":"restore_verify.missing_attachment_file"}' >&2
    exit 1
  }
  actual_hash="$(sha256sum "$attachments_dir/$storage_key" | awk '{print $1}')"
  actual_size="$(wc -c < "$attachments_dir/$storage_key" | tr -d ' ')"
  if [ "$actual_hash" != "$expected_hash" ] || [ "$actual_size" != "$expected_size" ]; then
    echo '{"level":"error","event":"restore_verify.attachment_integrity_failed"}' >&2
    exit 1
  fi
done < "$work_dir/attachment-inventory"

if [ "$archive_attachments" -lt "$database_attachments" ]; then
  echo '{"level":"error","event":"restore_verify.missing_attachment_files"}' >&2
  exit 1
fi

backup_epoch="$(sed -n '1p' "$marker")"
started_backup_epoch="$(sed -n 's/.*"startedEpoch":\([0-9][0-9]*\).*/\1/p' "$source_dir/metadata.json")"
# Backups novos medem a idade desde o começo da captura, conservadoramente.
if [ -n "$started_backup_epoch" ]; then backup_epoch="$started_backup_epoch"; fi
case "$backup_epoch" in ''|*[!0-9]*) exit 1 ;; esac
completed_epoch="$(date +%s)"
printf '{"timestamp":"%s","level":"info","service":"restore-verify","event":"restore_verify.completed","backup":"%s","tables":%s,"migrations":%s,"databaseAttachments":%s,"archiveFiles":%s,"durationSeconds":%s,"backupAgeSeconds":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup_name" "$tables" "$migrations" "$database_attachments" "$archive_attachments" "$((completed_epoch-started_epoch))" "$((completed_epoch-backup_epoch))"
