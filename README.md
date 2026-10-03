# AX Finance

Monólito modular para o SaaS descrito em [DIRECAO.md](./DIRECAO.md) — controle financeiro
multiempresa para empresas de serviços. Já é um MVP funcional: identidade, contas, títulos,
baixas, transferências, clientes/fornecedores, parcelamento, recorrências, conciliação
bancária, relatórios (fluxo de caixa, contas em aberto, DRE gerencial), trilha de auditoria,
fechamento de período e ajuste manual de saldo — não só a fundação.

## Stack

- `apps/web`: Next.js 15 (App Router) — UI + Route Handlers.
- `apps/worker`: consumidor da outbox, dos jobs agendados e das importações grandes —
  e-mails transacionais, recorrências, notificações, retentativas e dead letter.
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
7. Em outro terminal, `pnpm worker:dev` — processa a outbox, importações grandes, materializa
   recorrências e gera notificações/resumos. Sem SMTP no ambiente local, o envio é simulado;
   os links continuam visíveis na tela quando `EMAIL_PREVIEW=true`.

## Deploy via Docker

`docker compose up -d --build` (ver `.env.docker.example` para as variáveis necessárias).
`deploy.sh` automatiza atualização em produção (`git pull` + rebuild + prune de imagens antigas).

O Compose também sobe backup diário do PostgreSQL + anexos, health checks do web/worker/backup,
rotação de logs e monitoramento operacional. O teste isolado de restauração e o runbook completo
estão em [docs/OPERACAO_PRODUCAO.md](./docs/OPERACAO_PRODUCAO.md).

## Testes

`pnpm test` roda os testes de integração (Vitest) contra `ax_finance_test`, cobrindo isolamento
multiempresa, regras de saldo/baixa/estorno, fechamento de período, auditoria, busca e mais.

## Estado atual e limitações conhecidas

Um levantamento (set/2026) comparando a especificação com o código encontrou os pontos abaixo.
Nenhum é um bug ativo — são lacunas conscientes de um MVP em evolução, listadas aqui pra não se
perderem:

- **Gestão de acesso P0 implementada**: proprietário pode convidar, alterar papel e revogar
  usuários; operações de escrita, exportação, estorno e fechamento aplicam a matriz de
  permissões no domínio. O proprietário também pode transferir a propriedade (atômica, com um
  único proprietário ativo garantido por índice) e restringir um usuário a contas e centros de
  custo específicos; a restrição é aplicada no próprio banco (RLS). Ao transferir a propriedade
  ou revogar um membro, os jobs agendados passam a rodar como o proprietário atual. Ainda não
  existe delegação da gestão de usuários ao administrador financeiro.
- **Identidade reforçada**: MFA TOTP compatível com aplicativos autenticadores, códigos de
  recuperação de uso único, proteção contra repetição de código e segredo cifrado no banco.
  Recuperação de senha e verificação de e-mail usam tokens de uso único, expiração e SMTP
  configurável. Os e-mails passam por outbox transacional com payload cifrado, retentativas e
  worker separado. Convites de empresa são enviados por e-mail pela mesma outbox, com link
  disponível diretamente apenas como prévia no ambiente de desenvolvimento.
- **Idempotência financeira crítica implementada**: criação de títulos, baixas, transferências,
  ajustes de saldo, parcelamentos e as operações em lote de títulos (baixa integral, cancelamento
  e reclassificação) aceitam uma chave UUID por empresa/operação. Repetir a mesma chave e
  conteúdo devolve o recurso original; reutilizá-la com conteúdo diferente é recusado. A baixa
  em lote trava as linhas dos títulos antes de calcular o saldo, como a baixa individual.
  Importações continuam usando a deduplicação determinística por linha; cadastros auxiliares e
  comandos já naturalmente protegidos por estado ainda não gravam chave própria.
- **Rotina operacional assíncrona implementada**: o worker reivindica jobs persistentes com
  lock e retentativa, gera títulos recorrentes diariamente e produz notificações deduplicadas
  para vencimentos e resumo semanal. A campainha mantém estado de leitura; e-mails financeiros
  respeitam as preferências individuais. Cada usuário pode configurar, por empresa, antecedência,
  horário e canais (campainha e e-mail) para vencimentos e resumo semanal.
- **Anexos privados implementados**: títulos aceitam PDF/JPG/PNG/WebP de até 10 MB,
  validados pela assinatura binária e hash SHA-256. Metadados respeitam RLS e downloads
  exigem sessão/membership; no Docker, os arquivos ficam no volume persistente
  `attachments_data`, incluído no backup automático junto do PostgreSQL. Ainda não há
  varredura antivírus nem armazenamento S3 compatível; a cópia externa cifrada dos backups
  depende da infraestrutura escolhida em produção.
- **Ciclo de assinatura inicial**: cada empresa recebe trial de 14 dias e mantém estado de
  assinatura para avisos de trial, renovação, pagamento pendente, carência, suspensão e
  cancelamento. A integração com checkout, PSP e webhooks de cobrança ainda não foi implementada;
  esses estados serão alimentados pelo provedor quando essa integração entrar.
- **Importação e conciliação completas**: CSV com mapeamento assistido de valor ou de
  débito/crédito, OFX 1.x/2.x, pré-visualização antes da confirmação, deduplicação por linha/FITID
  e processamento persistente em segundo plano para arquivos grandes. A tela acompanha o status
  e a campainha avisa tanto a conclusão quanto uma falha definitiva após as retentativas.
- **Isolamento entre empresas em camadas**: as relações centrais (títulos, baixas, devoluções,
  transferências, ajustes, importações, linhas de extrato, anexos, recorrências, rateios e
  categorias) usam chaves estrangeiras compostas por `(id, company_id)`, então o banco recusa
  uma referência cruzada entre empresas; o RLS cobre o acesso direto. As tabelas operacionais
  do worker (outbox, jobs agendados e de importação) não têm RLS por empresa; o acesso a elas
  passa só por funções do domínio e pelo worker, nunca direto pelas telas.
- **Exclusão de título é suave e auditada**: `deleteTitle`/`deleteInstallmentPlan` marcam
  `deletedAt` com motivo e usuário, exigem período aberto e preservam baixas, conciliações e
  anexos para auditoria; o título só some das telas operacionais. Diverge da diretriz original
  (exclusão física apenas de rascunhos), mas não apaga eventos efetivados. `cancelTitle` segue
  existindo para manter o título visível como cancelado.
- **Painel administrativo interno** (`/admin`): exige papel em `platform_admins` e **MFA ativo**
  (checado no domínio, não só na tela). O painel enxerga apenas contagens por empresa, vindas de
  uma função de banco; não há política de leitura de títulos, baixas ou contas para nenhum
  papel interno. Ver [docs/OPERACAO_PRODUCAO.md](./docs/OPERACAO_PRODUCAO.md).

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
