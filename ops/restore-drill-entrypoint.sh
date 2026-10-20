#!/bin/sh
set -eu
umask 077
interval="${RESTORE_DRILL_INTERVAL_HOURS:-168}"
case "$interval" in ''|*[!0-9]*) exit 1 ;; esac
test "$interval" -ge 1 || exit 1
mkdir -p /evidence
while true; do
  run_id="$(date -u +%Y%m%dT%H%M%SZ)"
  if /bin/sh /ops/restore-verify.sh >"/evidence/$run_id.log" 2>&1; then
    printf '%s\n%s\n' "$(date +%s)" "$run_id" > /evidence/.last_success.tmp
    mv /evidence/.last_success.tmp /evidence/.last_success
    rm -f /evidence/.last_failure
  else
    printf '%s\n%s\n' "$(date +%s)" "$run_id" > /evidence/.last_failure
  fi
  cat "/evidence/$run_id.log"
  # Retém três meses de evidências; marcadores ficam preservados.
  find /evidence -maxdepth 1 -type f -name '*.log' -mtime +90 -delete
  sleep "$((interval * 3600))" &
  wait $!
done
