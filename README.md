# AX Finance

Monólito modular para o SaaS descrito em [DIRECAO.md](./DIRECAO.md) — controle financeiro
multiempresa para empresas de serviços. Já é um MVP funcional: identidade, contas, títulos,
baixas, transferências, clientes/fornecedores, parcelamento, recorrências, conciliação
bancária, relatórios (fluxo de caixa, contas em aberto, DRE gerencial), trilha de auditoria,
fechamento de período e ajuste manual de saldo — não só a fundação.

## Stack

- `apps/web`: Next.js 14 (App Router) — UI + Route Handlers.
- `apps/worker`: consumidor da outbox e dos jobs agendados — e-mails transacionais,
  recorrências, notificações, retentativas e dead letter.
- `packages/domain`: regras de negócio (identidade, empresas, contas, títulos, relatórios etc.).
  Sem Prisma direto na UI.
- `packages/db`: schema Prisma + migrations (inclui as políticas de Row Level Security).
- PostgreSQL 16/17. Dois caminhos de execução: nativo (dev local) ou Docker (`Dockerfile` +
  `docker-compose.yml`, ver `deploy.sh`).

## Setup local (nativo, sem Docker)

1. PostgreSQL instalado como serviço, bancos `ax_finance_dev` e `ax_finance_test` criados, role
   de aplicação `ax_app` criado pela migration de RLS.
2. Copie `.env.example` para `.env` (nunca commitado).
3. `pnpm install`
4. `pnpm db:migrate` — aplica migrations pendentes em `ax_finance_dev`.
5. `pnpm db:seed` — cria uma empresa de demonstração (`demo@ax.finance` / `demo12345`).
6. `pnpm dev` — sobe o Next.js em http://localhost:3000.
7. Em outro terminal, `pnpm worker:dev` — processa a outbox, materializa recorrências e gera
   notificações/resumos. Sem SMTP no ambiente local, o envio é simulado; os links continuam
   visíveis na tela quando `EMAIL_PREVIEW=true`.

## Deploy via Docker

`docker compose up -d --build` (ver `.env.docker.example` para as variáveis necessárias).
`deploy.sh` automatiza atualização em produção (`git pull` + rebuild + prune de imagens antigas).

## Testes

`pnpm test` roda os testes de integração (Vitest) contra `ax_finance_test`, cobrindo isolamento
multiempresa, regras de saldo/baixa/estorno, fechamento de período, auditoria, busca e mais.

## Estado atual e limitações conhecidas

Um levantamento (set/2026) comparando a especificação com o código encontrou os pontos abaixo.
Nenhum é um bug ativo — são lacunas conscientes de um MVP em evolução, listadas aqui pra não se
perderem:

- **Gestão de acesso P0 implementada**: proprietário pode convidar, alterar papel e revogar
  usuários; operações de escrita, exportação, estorno e fechamento aplicam a matriz de
  permissões no domínio. Ainda não existem transferência de propriedade, delegação da gestão
  de usuários ao administrador financeiro nem restrições por conta/centro de custo (P1).
- **Identidade reforçada**: MFA TOTP compatível com aplicativos autenticadores, códigos de
  recuperação de uso único, proteção contra repetição de código e segredo cifrado no banco.
  Recuperação de senha e verificação de e-mail usam tokens de uso único, expiração e SMTP
  configurável. Os e-mails passam por outbox transacional com payload cifrado, retentativas e
  worker separado. Convites de empresa continuam compartilhados manualmente por link.
- **Idempotência financeira crítica implementada**: criação de títulos, baixas, transferências,
  ajustes de saldo e parcelamentos aceitam uma chave UUID por empresa/operação. Repetir a mesma
  chave e conteúdo devolve o recurso original; reutilizá-la com conteúdo diferente é recusado.
  Importações continuam usando a deduplicação determinística por linha; cadastros auxiliares e
  comandos já naturalmente protegidos por estado ainda não gravam chave própria.
- **Rotina operacional assíncrona implementada**: o worker reivindica jobs persistentes com
  lock e retentativa, gera títulos recorrentes diariamente e produz notificações deduplicadas
  para vencimentos e resumo semanal. A campainha mantém estado de leitura; e-mails financeiros
  são enviados aos papéis responsáveis. Ainda não há tela para configurar antecedência,
  horário ou canal por usuário.
- **Sem anexos ou billing/assinatura**.
- **Importação de extrato é só CSV síncrono** — sem OFX, mapeamento de colunas ou processamento
  em background (ver "Fora do escopo" nos commits de conciliação).
- **Sem chaves estrangeiras compostas por `companyId`**: o isolamento entre empresas depende da
  validação no domínio + RLS, não de FKs compostas no schema. RLS cobre o caso de bypass da
  camada de aplicação; FKs compostas cobririam bugs de referência cruzada dentro do próprio
  domínio, que hoje só os testes de isolamento pegam.
- **Exclusão física de título**: `deleteTitle`/`deleteInstallmentPlan` apagam de verdade (mesmo
  com baixa) — decisão posterior explícita, diverge da diretriz original de nunca apagar eventos
  efetivados. `cancelTitle` (soft, preserva a linha) continua existindo para quem preferir esse
  caminho.

## Decisões que valem revisitar

- **RLS**: `companies`/`memberships` confiam parcialmente em `app.current_company_id` ter sido
  setado após checagem de aplicação; tabelas de dados financeiros (contas, títulos, baixas,
  transferências, ajustes de saldo, auditoria etc.) verificam membership de forma independente
  (política reforçada) — ao adicionar uma tabela nova, replicar esse padrão, não o mais simples.
- **Autenticação**: e-mail+senha própria (scrypt), sessão em cookie httpOnly + tabela `sessions`
  revogável, com "lembrar de mim" controlando se o cookie persiste além da aba. Novos cadastros
  exigem confirmação de e-mail; redefinir senha revoga sessões existentes; tentativas de login
  são limitadas por e-mail e IP. MFA TOTP é opcional por usuário, usa desafio curto no login e
  códigos de recuperação de uso único.
- **Onboarding é atômico**: empresa + conta + categorias padrão numa única transação
  (`completeOnboarding`) — evita empresa órfã sem conta/categorias se um passo do meio falhar.
