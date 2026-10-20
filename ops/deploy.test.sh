#!/usr/bin/env bash
# Simulação isolada: não acessa GitHub, banco nem Docker reais.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin" "$work/project/ops"
cp "$root/deploy.sh" "$work/project/deploy.sh"
cp "$root/ops/smoke-check.sh" "$work/project/ops/smoke-check.sh"
cat > "$work/bin/git" <<'MOCK'
#!/bin/sh
case "$*" in
  "status --porcelain --untracked-files=no") exit 0 ;;
  "rev-parse HEAD") printf '%040d\n' 1 ;;
  show*) printf 'services:\n  web: {}\n  worker: {}\n' ;;
  diff*) test "$TEST_SCENARIO" != migration_failure ;;
esac
MOCK
cat > "$work/bin/gh" <<'MOCK'
#!/bin/sh
if [ "$TEST_SCENARIO" = ci_failure ]; then echo failure; else echo success; fi
MOCK
cat > "$work/bin/docker" <<'MOCK'
#!/bin/sh
printf '%s\n' "$*" >> "$TEST_LOG"
case "$*" in
  "compose ps -q web") echo web-id ;;
  "compose ps -q worker") echo worker-id ;;
  inspect*) echo sha256:0123456789 ;;
  "compose build web worker migrate") test "$TEST_SCENARIO" != build_failure ;;
  "compose run --rm --no-deps -e BACKUP_ONCE=1 backup") test "$TEST_SCENARIO" != backup_failure ;;
  "compose run --rm --no-deps migrate") test "$TEST_SCENARIO" != migration_failure ;;
  "compose up -d --no-build --no-deps --wait --wait-timeout 180 web worker") test "$TEST_SCENARIO" != health_failure ;;
esac
MOCK
printf '#!/bin/sh\nexit 0\n' > "$work/bin/flock"
printf '#!/bin/sh\nexit 0\n' > "$work/bin/curl"
chmod +x "$work/bin/"*
export PATH="$work/bin:$PATH"
export TEST_LOG="$work/commands.log"
cd "$work/project"
for TEST_SCENARIO in success ci_failure build_failure backup_failure health_failure migration_failure; do
  export TEST_SCENARIO
  : > "$TEST_LOG"
  rm -rf .operations
  status=0
  bash ./deploy.sh 2222222222222222222222222222222222222222 > "$work/output" 2>&1 || status=$?
  case "$TEST_SCENARIO" in
    success)
      test "$status" -eq 0
      grep -q '"result":"passed"' .operations/releases/*/result.json
      ;;
    ci_failure)
      test "$status" -ne 0
      test ! -s "$TEST_LOG"
      ;;
    build_failure)
      test "$status" -ne 0
      ! grep -q 'run --rm --no-deps migrate' "$TEST_LOG"
      ;;
    backup_failure)
      test "$status" -ne 0
      grep -q 'compose stop backup' "$TEST_LOG"
      grep -q 'compose up -d --no-deps backup' "$TEST_LOG"
      ! grep -q 'run --rm --no-deps migrate' "$TEST_LOG"
      ;;
    health_failure)
      test "$status" -ne 0
      grep -q '"rollback":"restored"' .operations/releases/*/result.json
      ;;
    migration_failure)
      test "$status" -ne 0
      grep -q '"rollback":"requires_database_review"' .operations/releases/*/result.json
      ! grep -q 'rollback.yml up' "$TEST_LOG"
      ;;
  esac
  echo "Aprovado: $TEST_SCENARIO"
done
