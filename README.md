# AX Finance — fundação técnica

Monólito modular para o SaaS descrito em [DIRECAO.md](./DIRECAO.md). Esta etapa cobre só
identidade, isolamento multiempresa e contas financeiras (FIN-001/FIN-002) — títulos, baixas,
conciliação, relatórios etc. vêm depois, sobre esta base.

## Stack

- `apps/web`: Next.js 14 (App Router) — UI + Route Handlers.
- `packages/domain`: regras de negócio (identidade, empresas, contas). Sem Prisma direto na UI.
- `packages/db`: schema Prisma + migrations (inclui as políticas de Row Level Security).
- PostgreSQL 17 nativo no Windows (sem Docker).

## Setup local

1. PostgreSQL 17 já instalado como serviço (`postgresql-x64-17`), bancos `ax_finance_dev` e
   `ax_finance_test` criados, role de aplicação `ax_app` criado pela migration de RLS.
2. Copie `.env.example` para `.env` se ainda não tiver um (já existe um `.env` de dev funcional
   neste checkout — nunca commitado).
3. `pnpm install`
4. `pnpm db:migrate` — aplica migrations pendentes em `ax_finance_dev`.
5. `pnpm db:seed` — cria uma empresa de demonstração (`demo@ax.finance` / `demo12345`).
6. `pnpm dev` — sobe o Next.js em http://localhost:3000.

## Testes

`pnpm test` roda os testes de integração (Vitest) contra `ax_finance_test`, incluindo o teste que
prova isolamento entre empresas mesmo pulando a checagem de aplicação (a política de RLS de
`financial_accounts` verifica membership por conta própria).

## Decisões que valem revisitar

- **RLS**: `companies`/`memberships` confiam parcialmente em `app.current_company_id` ter sido
  setado após checagem de aplicação; `financial_accounts` (dados de dinheiro) verifica membership
  de forma independente. Ao adicionar títulos/baixas/razão, replicar o padrão de
  `financial_accounts`, não o mais simples.
- **Autenticação**: e-mail+senha própria (scrypt), sessão em cookie httpOnly + tabela `sessions`
  revogável. Sem MFA/verificação de e-mail ainda (stubs a implementar).
- **Sem worker/fila** ainda — não há nenhum job assíncrono real nesta etapa.
