#!/bin/sh
set -eu

evidence_root="${OPERATION_EVIDENCE_DIR:-.operations/evidence}"
backup_root="${BACKUP_HOST_DIR:-./.backups}"
operator="${OPERATION_OPERATOR:-unknown}"
case "$operator" in *[!A-Za-z0-9_.@-]*) operator="invalid" ;; esac

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_dir="$evidence_root/restore"
log_file="$evidence_dir/$run_id.log"
result_file="$evidence_dir/$run_id.json"
mkdir -p "$evidence_dir"
started_epoch="$(date +%s)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_name="unknown"
if [ -f "$backup_root/.last_success" ]; then
  backup_name="$(sed -n '2p' "$backup_root/.last_success")"
fi
case "$backup_name" in backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z) ;; *) backup_name="unknown" ;; esac

set +e
docker compose --profile operations run --rm restore-verify >"$log_file" 2>&1
status=$?
set -e
cat "$log_file"

completed_epoch="$(date +%s)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration="$((completed_epoch - started_epoch))"
commit="$(git rev-parse --verify HEAD 2>/dev/null || printf unknown)"
checksum="$(sha256sum "$log_file" | awk '{print $1}')"
outcome="failed"
if [ "$status" -eq 0 ]; then outcome="passed"; fi

printf '{"formatVersion":1,"operation":"restore-verification","startedAt":"%s","completedAt":"%s","durationSeconds":%s,"result":"%s","exitCode":%s,"backup":"%s","operator":"%s","gitCommit":"%s","logSha256":"%s","logFile":"%s"}\n' \
  "$started_at" "$completed_at" "$duration" "$outcome" "$status" "$backup_name" "$operator" "$commit" "$checksum" "$(basename "$log_file")" >"$result_file"
printf 'Evidência: %s\n' "$result_file"
exit "$status"
