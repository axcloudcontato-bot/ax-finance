# Cobrança da assinatura com Stripe

> Para ligar em **produção**, siga `docs/stripe-producao.md`. Este documento descreve o funcionamento e os testes no sandbox.

A assinatura do AX Finance é cobrada pela Stripe. O app **não guarda dados de cartão**: o pagamento
acontece no Checkout hospedado da Stripe e o gerenciamento (cartão, faturas, recibos, troca de plano)
no Portal do Cliente, também hospedado.

## Como funciona

1. O proprietário clica em **Assinar** em *Configurações → Assinatura*. O app cria (uma vez) um
   cliente na Stripe, abre um Checkout de assinatura **só com cartão** e redireciona para ele.
2. Se a empresa ainda está no trial de 14 dias com mais de 48 h restantes, o trial local vira o trial da
   assinatura: o cartão é cadastrado agora e a primeira cobrança só ocorre quando o trial termina.
3. A volta do Checkout (`?checkout=retorno`) **não ativa nada**. O plano muda quando o webhook chega, e o
   estado aplicado vem de uma **leitura nova da assinatura na Stripe**, não do corpo do evento. Por isso
   reentregas e eventos fora de ordem convergem para o mesmo resultado.
4. Falha de cobrança vira *Pagamento pendente* com carência de 7 dias; a Stripe tenta de novo conforme a
   configuração de retentativas da conta. Cobrança não recuperada vira *Suspensa*; assinatura encerrada
   vira *Cancelada*.
5. **Cancelar** pelo app agenda o cancelamento no fim do ciclo na Stripe **e** localmente (a Stripe é
   chamada primeiro; se ela recusar, nada muda). Cancelar ou trocar de plano pelo portal chega ao app
   pelos mesmos webhooks.

| Stripe | AX Finance |
| --- | --- |
| `trialing` | Período de avaliação |
| `active` | Ativa |
| `active` + cancelamento agendado | Cancelamento agendado |
| `past_due`, `incomplete` | Pagamento pendente (carência de 7 dias) |
| `unpaid`, `paused` | Suspensa |
| `canceled`, `incomplete_expired` | Cancelada |

## Configuração na Stripe (uma vez por ambiente)

Use o **modo de teste** primeiro. As chaves de teste começam com `sk_test_`.

1. **Produtos e preços**: crie dois preços **mensais em BRL**, um para *Gestão Pessoal* (R$ 29,90) e outro
   para *Essencial* (R$ 59,00). Copie os ids `price_…`.
2. **Portal do Cliente** (*Configurações → Billing → Portal do cliente*): habilite atualizar cartão,
   ver faturas e **troca de plano** (inclua os dois preços). A troca de plano acontece só ali; o app a
   acompanha pelo webhook e ajusta o plano local pelo preço.
3. **Webhook**: crie um endpoint apontando para `https://SEU_DOMINIO/api/webhooks/stripe` com estes eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
   Copie o **segredo de assinatura** (`whsec_…`).
4. **Retentativas e e-mails de cobrança**: revise *Billing → Configurações de assinaturas e e-mails*
   (retentativas inteligentes, o que fazer quando esgotarem).

## Variáveis de ambiente (servidor)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_ESSENTIAL=price_...
```

Digite-as diretamente no `.env` do servidor; nunca no repositório. Sem as quatro, a integração fica
desligada e a tela mantém o fluxo de solicitar mudança pelo suporte. Depois de alterar o `.env`:
`docker compose up -d web`.

## Testar ponta a ponta (modo de teste)

Com a [Stripe CLI](https://docs.stripe.com/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # imprime o whsec_ do ambiente local
```

1. Assine com o cartão `4242 4242 4242 4242` (qualquer data futura e CVC): a assinatura deve ficar
   **Ativa** (ou em avaliação, se o trial local ainda tiver mais de 48 h) e o plano deve acompanhar o preço.
2. Falha de cobrança: cartão `4000 0000 0000 0341` (anexa, mas falha ao cobrar) e depois
   `stripe trigger invoice.payment_failed`, ou avance o relógio de teste. Deve virar **Pagamento pendente**.
3. Agende o cancelamento pelo app e confira no Dashboard da Stripe que `cancel_at_period_end` ficou ativo;
   desfaça e confira que voltou.
4. Troque de plano pelo portal (*Gerenciar cobrança*) e confirme o novo plano no app.
5. Reenvie um evento pelo Dashboard: ele deve responder `duplicate` e não repetir efeitos.

## Segurança e operação

- A assinatura do webhook é verificada sobre o **corpo original** (tolerância de 5 minutos contra replay).
- Cada evento é registrado em `billing_events` (id único). A tabela não é acessível ao role da aplicação;
  só as funções `app_billing_*` (SECURITY DEFINER) leem e gravam, como no painel interno.
- Eventos com `outcome = 'FAILED'` respondem `500` e a Stripe reentrega. Para auditar:
  `SELECT event_id, type, outcome, detail, created_at FROM billing_events WHERE outcome <> 'PROCESSED' ORDER BY created_at DESC;`
- Cada mudança de estado confirmada pela Stripe gera um evento de auditoria *Assinatura atualizada pela
  cobrança*, com autor "Stripe".

## Conciliação periódica

O webhook é o caminho principal, mas pode falhar (app fora do ar por muito tempo, entrega esgotada,
evento perdido). Por isso o worker confere a cobrança com a Stripe **a cada hora e na partida**
(`BILLING_RECONCILE_INTERVAL_MS`, mínimo de 1 minuto):

- Lê, na Stripe, cada assinatura local ligada a ela e que não terminou, e corrige o que divergiu
  (status, plano, fim do ciclo, cancelamento agendado). Usa a mesma gravação e a mesma proteção de
  ordem do webhook, então rodar junto com um webhook é seguro.
- Recupera o **primeiro pagamento cujo webhook nunca chegou**: empresas que abriram o checkout nos
  últimos 3 dias e ainda não têm assinatura vinculada são procuradas pelo cliente, e a assinatura que
  leva o `companyId` delas nos metadados é vinculada.
- Cada correção vira uma linha em `billing_events` (`reconciliation.drift`, com o que mudou) e um
  evento de auditoria. Falha de rede em uma empresa não impede as outras
  (`reconciliation.error`, `FAILED`). Assinatura que não existe mais na Stripe só é contada.
- O worker só concilia se tiver `STRIPE_SECRET_KEY` e os dois `STRIPE_PRICE_*` (o `whsec_` é do web).
  O log estruturado `worker.billing_reconciliation_completed` traz `checked`, `inSync`, `corrected`,
  `missingInProvider` e `failed`; vira `warn` quando algo foi corrigido ou falhou.

Para rodar uma vez, na hora:

```bash
docker compose run --rm worker pnpm --filter worker start -- --reconcile-billing
```

Para ver as correções: `SELECT type, outcome, detail, created_at FROM billing_events WHERE type LIKE 'reconciliation.%' ORDER BY created_at DESC;`

### Testar um webhook perdido (modo de teste)

1. Pare o `stripe listen` e, na Stripe, agende o cancelamento:
   `stripe subscriptions update sub_XXX -d cancel_at_period_end=true`
2. Confirme que o app **não** mudou (`status` ainda `ACTIVE` ou `TRIAL`).
3. Rode o comando acima: o resumo deve mostrar `"corrected":1` e o app passa a `CANCELLATION_SCHEDULED`.
4. Desfaça com `cancel_at_period_end=false`, rode de novo e confira que volta ao normal.

## Suspensa para escrita

Com a assinatura **Suspensa** (`unpaid`/`paused` na Stripe), **encerrada** (`canceled`) ou com o
**trial vencido sem pagamento**, a empresa continua vendo e exportando os dados, mas **não cria nem
altera lançamentos** (DIRECAO §21):

- **Bloqueia:** toda operação com permissão de escrita (lançamentos, baixas, estornos, transferências,
  cadastros, importação, anexos, fechamento). A regra vive num único ponto, em
  `assertCompanyPermission`, e a mensagem diz como regularizar. A rotina diária de recorrências do
  worker para em silêncio, sem gerar erro nem títulos.
- **Libera:** leitura de todas as telas, exportação completa, a página de Assinatura (pagar, portal,
  cancelar) e a gestão de usuários. Zerar lançamentos também continua com o proprietário.
- **Não bloqueia:** pagamento pendente e carência de 7 dias; só avisam. Cancelamento agendado grava até
  a data efetiva e, depois dela, vale como encerrado mesmo sem sinal da Stripe.
- Voltar a pagar (a Stripe devolve `active`) libera a escrita na hora.

**Fim do trial sem pagamento:** o trial local de 14 dias termina em `trial_ends_at`; a partir daí, quem
não tem assinatura na Stripe fica bloqueado para escrita até assinar (a tela mostra "Avaliação
encerrada" e o caminho para assinar). Quem já assinou com cartão durante o trial **não** é bloqueado
pela data: o trial passa a ser o da Stripe, a primeira cobrança é no fim dele e quem decide o estado é
o provedor (o webhook que vira `ACTIVE` pode levar alguns minutos). Para estender um trial, o painel
interno ajusta `trial_ends_at` e a escrita volta na hora. O aviso de "trial próximo do fim" (7, 3 e 1
dia) e o de "trial encerrado" já existiam nas notificações.

**Antes de ligar para clientes reais:** a Stripe de **produção** precisa estar configurada. Sem ela, a
empresa bloqueada pelo fim do trial não tem como assinar sozinha.

## O que ainda não existe

- **Boleto/Pix** e **nota fiscal** da assinatura.
- **Carência depois do fim do trial** (hoje o bloqueio é imediato) e **aviso na tela** de que a empresa está
  bloqueada (hoje o usuário descobre ao tentar gravar, pela Assinatura e pela campainha).
