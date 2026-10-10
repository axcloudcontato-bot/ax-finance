# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AX Finance is a multi-company financial-control SaaS (business and personal plans), built as a modular monolith. The product spec is `DIRECAO.md` (sections are referenced in code comments as "Seção N"). All UI text, code comments, commit messages and user-facing errors are in Brazilian Portuguese.

## Commands

pnpm monorepo (`pnpm@12`, Node ≥ 20). Run from the repo root unless noted.

- `pnpm dev` — Next.js on http://localhost:3000. `pnpm worker:dev` — worker (outbox, scheduled jobs, large imports). Without SMTP, e-mails are simulated.
- `pnpm lint` — ESLint for the whole repo (errors break CI; warnings don't). Run the root lint, not just `apps/web`: domain/worker files are linted too.
- `pnpm typecheck` — tsc for db, domain, worker and web. Per package: `pnpm --filter web exec tsc --noEmit`, `pnpm --filter @ax-finance/domain exec tsc --noEmit`.
- `pnpm test` — Vitest integration tests (real Postgres, `ax_finance_test`). Single file: `pnpm exec vitest run packages/domain/src/__tests__/<file>.test.ts` (must be run from the root: `vitest.config.ts` and `vitest.setup.ts` live there). Test files run sequentially (shared DB); don't run two vitest processes at once — they truncate each other's data.
- `pnpm e2e` — Playwright end-to-end tests in `e2e/` against a dedicated `ax_finance_e2e` DB that `e2e/global-setup.ts` creates, migrates, truncates and seeds each run; app on port 3100. First time: `pnpm exec playwright install chromium`.
- `pnpm --filter web build` — production build (catches things tsc doesn't, e.g. invalid exports from `page.tsx`).
- `pnpm db:migrate:deploy` — apply migrations (dev DB from `.env`). For the test DB: `DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate:deploy` (needed after adding a migration, or tests fail with "relação não existe").
- `pnpm db:seed` — demo company (`demo@ax.finance`, see `packages/db/prisma/seed.ts`).

CI (`.github/workflows/ci.yml`): lint + typecheck, integration tests, a backup→restore check using the real `ops/` scripts, and the e2e job. `security.yml` runs `pnpm audit --prod --audit-level high` and the build.

## Migrations and Prisma

- Migrations are **hand-written SQL** in `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql`, applied with `prisma migrate deploy`. `schema.prisma` does not mirror the migrations 1:1 (RLS policies, grants, check constraints, functions live only in SQL). Do not use `prisma migrate dev` / `db:migrate` to generate migrations.
- When adding a table: update `schema.prisma` + write the SQL, then `pnpm --filter @ax-finance/db exec prisma generate`, and add the table to the TRUNCATE list in `packages/domain/src/__tests__/test-db.ts`.
- New company-scoped tables must copy the **reinforced RLS pattern** (`ENABLE` + `FORCE ROW LEVEL SECURITY`, a policy that checks `app.current_company_id` **and** an ACTIVE membership via `EXISTS`, `GRANT ... TO ax_app`). See `20261006100000_budgets` or `20261009100000_savings_goals`. Prefer composite FKs `(id, company_id)` for references between company data.
- A new enum value (`ALTER TYPE ... ADD VALUE`) can't be used in the same migration; put the usage in a following migration.
- On Windows, `prisma generate` fails with EPERM while a dev server holds the query-engine DLL; the TypeScript types are usually written anyway. Stop the server and regenerate when in doubt.

## Architecture

```
apps/web        Next.js 15 App Router: pages, server actions, route handlers (UI only, no Prisma)
apps/worker     long-running process: outbox e-mails, scheduled jobs, background imports, monitoring
packages/domain all business rules (zod-validated inputs, permissions, RLS context, audit)
packages/db     Prisma schema, SQL migrations, prisma client + RLS context helpers
```

Packages ship TypeScript sources (no build step); `next.config.mjs` transpiles them.

### Database access and isolation
- The app connects as the low-privilege role `ax_app` (`APP_DATABASE_URL`); the owner/superuser (`DATABASE_URL`) is only for migrations, seeds and test housekeeping. RLS is enforced by Postgres, not just by the app.
- Every company-scoped query goes through `withCompanyContext(userId, companyId, tx => ...)` (`packages/db/src/context.ts`), which opens a transaction and sets `app.current_user_id` / `app.current_company_id`. Callers must first check the membership (`assertActiveMembership`) or permission (`assertCompanyPermission(userId, companyId, "FINANCE_WRITE" | "CATALOG_WRITE" | "REVERSAL" | ...)`). Write permissions also enforce the subscription write-block.
- Functions that must run inside a caller's transaction take a `TenantScopedClient` and are named `...InTx` (e.g. `registerSettlementInTx`, `insertTitleInTx`).

### Domain conventions (`packages/domain/src`)
- One folder per area (`titles`, `financial-accounts`, `transfers`, `reconciliation`, `credit-cards`, `savings-goals`, `wealth`, `reports`, `budgets`, ...), each re-exported through its `index.ts` and `src/index.ts`. The web imports everything from `@ax-finance/domain`.
- Inputs are parsed with zod inside the domain function (`rawInput: unknown`). Errors are classes extending `DomainError` in `errors.ts` with a Portuguese message; `apps/web/lib/action-errors.ts` turns them (and zod errors, via `FIELD_LABEL`) into user messages.
- Money is always integer cents as `bigint` in the DB and domain (inputs as `number` cents). Dates of calendar meaning are `@db.Date` strings `YYYY-MM-DD`; "today" must come from `companyToday(tx, companyId)` / `todayInTimeZone()` (company timezone), never `new Date()` in UTC.
- Balances are always recomputed from source records (`computeAccountBalanceDeltas`: settlements, refunds, transfers, adjustments), never stored counters.
- Financial writes record `recordAuditEvent(tx, ...)` in the same transaction (labels in `audit/event-labels.ts`), check `assertPeriodOpen` for closed periods, lock rows with `SELECT ... FOR UPDATE` before computing balances, and accept an optional `idempotencyKey` (`beginIdempotentOperation` / `completeIdempotentOperation`).
- Titles (`Title`, RECEIVABLE/PAYABLE) are the core: settlements ("baixas") reduce the open balance; deletion is soft (`deletedAt`). Credit-card invoices are PAYABLE titles; card purchases carry their own category/competence and the DRE counts purchases, not the invoice title.
- Savings goals ("cofrinhos") own an internal `FinancialAccount` of type `SAVINGS_GOAL`; deposits/withdrawals are transfers. **Any query listing or accepting "the user's accounts" must spread `OPERATIONAL_ACCOUNT`** (`financial-accounts/operational.ts`) so internal accounts don't leak into selectors, settlements, imports or plain transfers.
- Raw SQL: use native arrays (`= ANY(${ids}::text[])`), not `Prisma.join`/`Prisma` helpers — those break when the domain is bundled by Next even though vitest passes.

### Web (`apps/web`)
- Authenticated pages live in `app/(app)/`, admin in `app/(admin)/`, public pages at the top level. Pages are async server components that call `getCurrentUser()` + `requirePrimaryCompany(user.id)` and then domain functions.
- Mutations are server actions in an `actions.ts` next to the page. Pattern: only the domain call goes inside `try/catch` (because `redirect()` throws), and outcomes are reported by redirecting with query params (`?erro=...`, `?salvo=1`) that the page renders as `.error` / `.success-box`. Modals that failed are reopened via `initiallyOpen`.
- `page.tsx` files may only export what Next allows; shared constants go in `lib/` (e.g. `lib/wealth-labels.ts`).
- UI building blocks: `ActionModal` (modal; renders children only when open), `RowActionsMenu` ("Gerenciar" dropdown for table rows), `SubmitButton`, `QuickCreateButton`/`openQuickCreate` (global "+" create modal). Money inputs use `type="text" inputMode="decimal"`; a global `MoneyInputMask` formats every such field, and actions parse with `parseAmountToCents`.
- Styling is a single large `app/globals.css` with design tokens (`--text`, `--muted`, `--border`, `--card`, `--accent`) and light/dark themes via `:root[data-ax-theme="dark"]`. Buttons follow the `.ax-model-buttons` rules, which have high specificity — overrides must come later in the file or be more specific. Page headers use `.page-header` > `h1` + `.subtitle`; summary numbers use `.workspace-metrics` / `.workspace-metric`.
- User-visible features get an entry at the top of `lib/changelog.ts` (shown in "Novidades").

### Worker (`apps/worker`)
- `processor.ts` claims `ScheduledJob`s (per company: recurrences, due notifications, weekly summary, subscription notices, monthly report) and `OutboxEvent`s with locks and retries; `email.ts` renders each outbox type with `email-layout.ts` and sends via nodemailer (attachments supported). New scheduled job types must be added to `JOB_TYPES` in `packages/domain/src/scheduled-jobs/jobs.ts` and get a migration creating the job for existing companies.

## Deploy

Production runs with Docker Compose on a server: `git pull && ./deploy.sh` rebuilds, runs the `migrate` service (applies pending migrations automatically), then starts web and worker and runs smoke checks. Secrets are set directly on the server's `.env`. Backups: `ops/backup-entrypoint.sh` (daily) and `ops/run-restore-verification.sh` (restore test); runbook in `docs/OPERACAO_PRODUCAO.md`.
