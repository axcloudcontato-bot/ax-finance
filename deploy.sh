#!/usr/bin/env bash
# Atualiza o AX Finance em produção: git pull + rebuild/redeploy via Docker
# Compose. Rodar direto no servidor, dentro do checkout do projeto (ou de
# qualquer lugar — o script se posiciona sozinho no diretório onde está).
#
# Uso: ./deploy.sh

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> Verificando o repositório..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Há alterações locais não commitadas neste checkout:"
  git status --short
  echo "Aborta pra não perder nada — resolva (commit/stash) e rode de novo."
  exit 1
fi

echo "==> Atualizando o código (git pull)..."
git pull --ff-only

echo "==> Subindo containers (build + migrate + web)..."
docker compose up -d --build

echo "==> Status dos containers:"
docker compose ps

echo "==> Limpando imagens Docker antigas (dangling)..."
docker image prune -f

echo "==> Concluído."
