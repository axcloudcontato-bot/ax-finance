#!/usr/bin/env bash
# Publica um commit aprovado pelo CI. Sem argumento, usa o último commit da master remota;
# com um SHA, publica (ou volta para) aquele commit. Veja docs/ENTREGA_SEGURA.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
umask 077
target="${1:-}"
if [ -n "$target" ] && [[ ! "$target" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Uso: ./deploy.sh [SHA_COMPLETO_DO_COMMIT]  (sem SHA, publica o último commit da master)" >&2
  exit 1
fi
for command in git docker gh flock; do command -v "$command" >/dev/null || { echo "Falta instalar: $command" >&2; exit 1; }; done
mkdir -p .operations/releases
exec 9>.operations/releases/deploy.lock
flock -n 9 || { echo "Outra publicação está em andamento." >&2; exit 1; }
test ! -f .operations/releases/recovery-required || { echo "A publicação anterior exige recuperação. Confira .operations/releases/recovery-required e o runbook." >&2; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo "Há alterações locais em arquivos versionados." >&2; exit 1; }
git fetch origin
if [ -z "$target" ]; then
  target="$(git rev-parse origin/master)"
  echo "Publicando o último commit da master: $target"
fi
git cat-file -e "$target^{commit}"
git merge-base --is-ancestor "$target" origin/master || { echo "O commit precisa pertencer à master remota." >&2; exit 1; }
for workflow in ci.yml security.yml; do
  result="$(gh run list --workflow "$workflow" --commit "$target" --limit 1 --json conclusion,status --jq '.[0] | select(.status == "completed") | .conclusion')"
  test "$result" = success || { echo "Verificação não aprovada para este commit: $workflow" >&2; exit 1; }
done
previous="$(git rev-parse HEAD)"
if [ -f .operations/releases/current_commit ]; then
  previous="$(cat .operations/releases/current_commit)"
  [[ "$previous" =~ ^[a-f0-9]{40}$ ]] || { echo "Registro da versão anterior inválido." >&2; exit 1; }
fi
run_id="$(date -u +%Y%m%dT%H%M%SZ)-${target:0:12}"
evidence=".operations/releases/$run_id"
mkdir -p "$evidence"
previous_web="$(docker compose ps -q web)"
previous_worker="$(docker compose ps -q worker)"
rollback_ready=false
# Guarda a imagem em execução para o retorno automático. Com o armazenamento de imagens do containerd,
# o ID que o contêiner informa pode não servir para "docker image tag": tenta o ID e depois o nome.
preserve_image() {
  local container="$1" target="$2" ref
  ref="$(docker inspect --format '{{.Image}}' "$container" 2>/dev/null || true)"
  if [ -n "$ref" ] && docker image tag "$ref" "$target" 2>/dev/null; then return 0; fi
  ref="$(docker inspect --format '{{.Config.Image}}' "$container" 2>/dev/null || true)"
  if [ -n "$ref" ] && docker image tag "$ref" "$target" 2>/dev/null; then return 0; fi
  return 1
}
if [ -n "$previous_web" ] && [ -n "$previous_worker" ]; then
  if preserve_image "$previous_web" "ax-finance-web:rollback-$run_id" && preserve_image "$previous_worker" "ax-finance-worker:rollback-$run_id"; then
    git show "$previous:docker-compose.yml" > "$evidence/previous-compose.yml"
    printf 'services:\n  web:\n    image: ax-finance-web:rollback-%s\n  worker:\n    image: ax-finance-worker:rollback-%s\n' "$run_id" "$run_id" > "$evidence/rollback.yml"
    rollback_ready=true
  else
    echo "Aviso: não foi possível guardar as imagens em execução; esta publicação segue sem retorno automático das imagens (o backup antes das migrações continua)." >&2
  fi
  printf '%s\n' "$previous" > .operations/releases/current_commit
fi
schema_changed=false
if ! git diff --quiet "$previous" "$target" -- packages/db/prisma/migrations; then schema_changed=true; fi
migration_started=false
services_changed=false
backup_paused=false
finish() {
  status=$?
  trap - EXIT
  if [ "$backup_paused" = true ]; then
    # Retoma o agendamento mesmo quando o backup ou seu ensaio falham.
    docker compose up -d --no-deps backup || true
  fi
  outcome=passed
  rollback=unnecessary
  if [ "$status" -ne 0 ]; then
    outcome=failed
    rollback=not_attempted
    if [ "$migration_started" = true ] && [ "$schema_changed" = true ]; then
      rollback=requires_database_review
      printf '%s\n' "$evidence" > .operations/releases/recovery-required
      echo "A migração foi iniciada: retorno exige revisar a compatibilidade do banco. Backup e imagens anteriores estão preservados." >&2
    elif [ "$services_changed" = true ] && [ "$rollback_ready" = true ]; then
      rollback=failed
      if docker compose --project-directory "$PWD" -f "$evidence/previous-compose.yml" -f "$evidence/rollback.yml" up -d --no-build --no-deps --wait --wait-timeout 180 web worker; then
        rollback=restored
      else
        printf '%s\n' "$evidence" > .operations/releases/recovery-required
      fi
    fi
  fi
  printf '{"version":1,"commit":"%s","previousCommit":"%s","result":"%s","rollback":"%s","schemaChanged":%s,"exitCode":%s,"completedAt":"%s"}\n' \
    "$target" "$previous" "$outcome" "$rollback" "$schema_changed" "$status" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$evidence/result.json"
  echo "Evidência: $evidence/result.json"
  if [ "$status" -eq 0 ]; then
    printf '%s\n' "$target" > .operations/releases/current_commit
  fi
  exit "$status"
}
trap finish EXIT
git switch --detach "$target"
docker compose build web worker migrate
docker compose up -d --wait --wait-timeout 120 postgres
# O backup agendado e o pré-publicação usam o mesmo volume e marcador.
# Interrompe o agendado antes da captura para impedir gravações concorrentes.
backup_paused=true
docker compose stop backup
docker compose run --rm --no-deps -e BACKUP_ONCE=1 backup
docker compose --profile operations run --rm --no-deps restore-verify > "$evidence/restore.log" 2>&1
cat "$evidence/restore.log"
migration_started=true
docker compose run --rm --no-deps migrate
services_changed=true
docker compose up -d --no-build --no-deps --wait --wait-timeout 180 web worker
APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}" /bin/sh ./ops/smoke-check.sh
docker compose up -d --no-deps backup restore-drill
backup_paused=false
echo "Publicação aprovada: $target"
