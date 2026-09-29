#!/bin/sh
set -eu

evidence_root="${OPERATION_EVIDENCE_DIR:-.operations/evidence}"
operator="${OPERATION_OPERATOR:-unknown}"
case "$operator" in *[!A-Za-z0-9_.@-]*) operator="invalid" ;; esac
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_dir="$evidence_root/alerts"
log_file="$evidence_dir/$run_id.log"
result_file="$evidence_dir/$run_id.json"
mkdir -p "$evidence_dir"
started_epoch="$(date +%s)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

set +e
docker compose run --rm worker pnpm --filter worker start -- --test-alert-webhook >"$log_file" 2>&1
status=$?
set -e
cat "$log_file"

completed_epoch="$(date +%s)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
checksum="$(sha256sum "$log_file" | awk '{print $1}')"
outcome="failed"
if [ "$status" -eq 0 ]; then outcome="passed"; fi
printf '{"formatVersion":1,"operation":"alert-webhook-test","startedAt":"%s","completedAt":"%s","durationSeconds":%s,"result":"%s","exitCode":%s,"operator":"%s","logSha256":"%s","logFile":"%s"}\n' \
  "$started_at" "$completed_at" "$((completed_epoch - started_epoch))" "$outcome" "$status" "$operator" "$checksum" "$(basename "$log_file")" >"$result_file"
printf 'Evidência: %s\n' "$result_file"
exit "$status"
