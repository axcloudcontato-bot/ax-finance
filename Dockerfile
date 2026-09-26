# syntax=docker/dockerfile:1
# Build multi-stage do monorepo AX Finance (pnpm workspaces).
# Dois alvos finais: `web` (Next.js em modo standalone) e `migrate`
# (roda `prisma migrate deploy` uma vez, antes do `web` subir).

FROM node:20-bookworm-slim AS base
# Prisma precisa de libssl em runtime, não só no build.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
# --ignore-scripts: o postinstall de packages/db chama `prisma generate`, que
# precisa do schema.prisma — ainda não copiado nesta etapa (só os package.json,
# para aproveitar o cache do Docker enquanto o código-fonte muda). O generate
# roda explicitamente depois que o restante do código é copiado.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
RUN pnpm --filter @ax-finance/db exec prisma generate
RUN pnpm --filter web build

# ---- imagem da aplicação web ----
FROM base AS web
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---- imagem só para aplicar migrations (job de curta duração) ----
FROM deps AS migrate
COPY packages/db packages/db
COPY packages/domain packages/domain
RUN pnpm --filter @ax-finance/db exec prisma generate
CMD ["pnpm", "--filter", "@ax-finance/db", "exec", "prisma", "migrate", "deploy"]
