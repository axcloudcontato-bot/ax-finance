#!/bin/sh
set -eu

BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"

attempt=1
until curl --fail --silent --show-error "$BASE_URL/api/health/ready"; do
  if [ "$attempt" -ge 30 ]; then
    echo "Readiness não ficou disponível dentro de 150 segundos." >&2
    exit 1
  fi
  attempt="$((attempt + 1))"
  sleep 5
done
printf '\n'
curl --fail --silent --show-error "$BASE_URL/api/health/live"
printf '\n'
docker compose ps
