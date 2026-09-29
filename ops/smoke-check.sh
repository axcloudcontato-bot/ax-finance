#!/bin/sh
set -eu

BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"

check_endpoint() {
  name="$1"
  url="$2"
  shift 2
  curl --fail --silent --show-error "$@" "$url" >/dev/null
  printf '{"level":"info","event":"smoke_check.passed","check":"%s"}\n' "$name"
}

attempt=1
until curl --fail --silent --show-error "$BASE_URL/api/health/ready" >/dev/null; do
  if [ "$attempt" -ge 30 ]; then
    echo "Readiness não ficou disponível dentro de 150 segundos." >&2
    exit 1
  fi
  attempt="$((attempt + 1))"
  sleep 5
done
check_endpoint ready "$BASE_URL/api/health/ready"
check_endpoint live "$BASE_URL/api/health/live"

if [ -n "${METRICS_TOKEN:-}" ]; then
  check_endpoint metrics "$BASE_URL/api/metrics" -H "Authorization: Bearer $METRICS_TOKEN"
fi
if [ -n "${OPERATIONS_TOKEN:-}" ]; then
  check_endpoint diagnostics "$BASE_URL/api/ops/diagnostics" -H "Authorization: Bearer $OPERATIONS_TOKEN"
fi
if command -v docker >/dev/null 2>&1; then
  docker compose ps
fi
