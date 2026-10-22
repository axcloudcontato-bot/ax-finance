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
  "rev-parse origin/master") printf '%040d\n' 3 ;;
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
  *Config.Image*) echo ax-finance-web ;;
  inspect*) echo sha256:0123456789 ;;
  "image tag sha256:"*) test "$TEST_SCENARIO" != tag_by_name && test "$TEST_SCENARIO" != tag_unavailable ;;
  "image tag ax-finance-web "*) test "$TEST_SCENARIO" != tag_unavailable ;;
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
for TEST_SCENARIO in success ci_failure build_failure backup_failure health_failure migration_failure tag_by_name tag_unavailable no_argument; do
  export TEST_SCENARIO
  : > "$TEST_LOG"
  rm -rf .operations
  status=0
  if [ "$TEST_SCENARIO" = no_argument ]; then
    bash ./deploy.sh > "$work/output" 2>&1 || status=$?
  else
    bash ./deploy.sh 2222222222222222222222222222222222222222 > "$work/output" 2>&1 || status=$?
  fi
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
    no_argument)
      # Sem SHA: publica o último commit da master remota, com as mesmas verificações.
      test "$status" -eq 0
      grep -q 'Publicando o último commit da master: 0000000000000000000000000000000000000003' "$work/output"
      grep -q '"commit":"0000000000000000000000000000000000000003"' .operations/releases/*/result.json
      ;;
    tag_by_name)
      # O ID da imagem não serve para "tag" (containerd): guarda pelo nome e publica normalmente.
      test "$status" -eq 0
      grep -q 'image tag ax-finance-web ax-finance-web:rollback-' "$TEST_LOG"
      ls .operations/releases/*/rollback.yml > /dev/null
      ;;
    tag_unavailable)
      # Sem como guardar a imagem: avisa e publica, sem retorno automático das imagens.
      test "$status" -eq 0
      grep -q 'sem retorno automático' "$work/output"
      ! ls .operations/releases/*/rollback.yml > /dev/null 2>&1
      grep -q '"result":"passed"' .operations/releases/*/result.json
      ;;
    migration_failure)
      test "$status" -ne 0
      grep -q '"rollback":"requires_database_review"' .operations/releases/*/result.json
      ! grep -q 'rollback.yml up' "$TEST_LOG"
      ;;
  esac
  echo "Aprovado: $TEST_SCENARIO"
done
