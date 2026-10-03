# Stripe em produção: roteiro de ativação

Pré-requisito: o fluxo já foi validado no sandbox (ver `docs/stripe-billing.md`). Este roteiro repete a
configuração na conta de **produção**, que é um ambiente separado: produtos, preços, chaves, webhook e portal
**não** passam do sandbox para lá.

> Segredos (`sk_live_…`/`rk_live_…` e o `whsec_…` de produção) são digitados **por você, direto no `.env` do
> servidor**. Não os cole em chats, tickets, commits ou capturas de tela.

## 0. Antes de começar

- [ ] A conta de produção está **ativada** na Stripe (dados da empresa, representante legal, conta bancária
      para repasse). Sem isso, o modo de produção não aceita cobranças.
- [ ] Os documentos do site estão publicados: Termos, Privacidade e política de cobrança/cancelamento. A Stripe
      e o cliente os veem no checkout e no portal.
- [ ] O domínio de produção responde em **HTTPS** e `APP_BASE_URL` no `.env` do servidor é esse endereço
      (`https://…`). As URLs de retorno do checkout e do portal saem dela.
- [ ] Backup do banco de produção feito.

## 1. Produtos e preços (produção)

No Dashboard, em **modo de produção** (sem a faixa "Área restrita"), crie dois produtos com preço **mensal em
BRL**:

| Plano | Nome sugerido | Valor |
| --- | --- | --- |
| Gestão Pessoal | AX Finance | Gestão Pessoal | R$ 29,90 / mês |
| Essencial | AX Finance | Essencial | R$ 59,00 / mês |

Os nomes aparecem para o cliente no checkout e nas faturas: confira a grafia. Copie os dois `price_…`
(não são segredo).

## 2. Chave de API: use uma chave restrita

Em *Desenvolvedores → Chaves de API → Criar chave restrita*, nome `ax-finance-web-worker`, com **só** estas
permissões:

| Recurso | Permissão | Para quê |
| --- | --- | --- |
| Customers | Write | criar o cliente no primeiro checkout |
| Checkout Sessions | Write | abrir o pagamento |
| Customer portal | Write | abrir "Gerenciar cobrança" |
| Subscriptions | Write | ler o estado, conciliar e agendar/desfazer cancelamento |
| Prices | Read | verificação de configuração (`--check-billing`) |

Uma chave restrita vazada faz muito menos estrago que a chave secreta padrão. Se algum recurso der erro de
permissão nos testes, adicione só o que a mensagem pedir.

## 3. Portal do cliente (produção)

*Configurações → Billing → Portal do cliente*, no modo de produção:

- [ ] Atualizar forma de pagamento e ver faturas/recibos: ligados.
- [ ] **Trocar de plano**: ligado, com os dois preços. Em *quando entra em vigor*, **Ratear taxas e créditos**
      (imediato, proporcional).
- [ ] **Cancelar assinatura**: ligado, **no fim do ciclo** (combina com o cancelamento do app).
- [ ] Links de Termos e Privacidade preenchidos.

## 4. Recuperação de cobranças (muito importante)

*Billing → Configurações → Assinaturas e e-mails*:

- [ ] **Retentativas inteligentes**: ligadas.
- [ ] **Quando as tentativas se esgotarem**: escolha **"Marcar a assinatura como não paga"** (`unpaid`), e não
      "cancelar". O app trata `unpaid` como **Suspensa** (bloqueia escrita) e quem pagar a fatura em aberto
      volta a `ACTIVE` sem recriar a assinatura. Cancelar a assinatura exigiria um novo checkout.
- [ ] E-mails de pagamento recusado/recibo ligados.

## 5. Webhook (produção)

*Desenvolvedores → Webhooks → Adicionar endpoint*:

- URL: `https://SEU_DOMINIO/api/webhooks/stripe`
- Eventos (6): `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- **Versão da API**: a mais recente (a mesma do sandbox). Versões anteriores a `2025-03-31` não trazem
  `invoice.parent.subscription_details`, e os eventos de fatura seriam ignorados.
- Copie o **segredo de assinatura** (`whsec_…`) deste endpoint. É diferente do do sandbox e da CLI.

## 6. `.env` do servidor

Digite você mesmo, substituindo os valores de teste:

```env
STRIPE_SECRET_KEY=rk_live_...            # a chave restrita do passo 2
STRIPE_WEBHOOK_SECRET=whsec_...          # do endpoint do passo 5
STRIPE_PRICE_PERSONAL=price_...          # produção, R$ 29,90
STRIPE_PRICE_ESSENTIAL=price_...         # produção, R$ 59,00
APP_BASE_URL=https://SEU_DOMINIO
```

Depois: `docker compose up -d web worker`.

## 7. Verificações (nada é cobrado)

1. **Configuração**: lê chave, modo e os dois preços.

   ```bash
   docker compose run --rm worker pnpm --filter worker start -- --check-billing
   ```

   Esperado: `"mode": "live"`, `"ok": true`, `"problems": []`, com `amountCents` 2990 e 5900, `brl` e
   `1/month`. Se `ok` for `false`, a lista `problems` diz o que corrigir (chave de teste em produção, preços
   trocados, valor errado, preço de outro modo).

2. **Webhook acessível** (sem assinatura deve recusar com 400, e não 503 nem 404):

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://SEU_DOMINIO/api/webhooks/stripe
   ```

3. **Conciliação** (lê as assinaturas locais na Stripe; deve terminar sozinho com `"failed":0`):

   ```bash
   docker compose run --rm worker pnpm --filter worker start -- --reconcile-billing
   ```

4. No Dashboard, o endpoint do webhook deve aparecer como **ativo**, sem tentativas falhando.

## 8. Primeira cobrança de verdade (com cartão seu)

Use uma empresa sua, no plano mais barato:

1. Em Configurações → Assinatura, **Assinar** e pague com um cartão **real seu**.
   - Se a empresa ainda tem **mais de 48 h** de trial, a primeira cobrança só ocorre no fim do trial. Para
     ver a cobrança agora, use uma empresa com trial vencido ou com menos de 49 h.
2. Confira: no Dashboard o evento chegou com **200**; no banco `status = ACTIVE`, `plan_code` certo e
   `stripe_subscription_id` preenchido; em `/auditoria`, "Assinatura atualizada pela cobrança".
3. Teste **Gerenciar cobrança** (abre o portal de produção) e o cancelamento agendado e desfeito.
4. Devolva o valor: no Dashboard, abra o pagamento → **Reembolsar**. Cancele a assinatura de teste.

## 9. Depois de ligar

- Os trials vencidos passam a poder ser pagos de verdade. Revise as empresas em `TRIAL` sem assinatura
  (`SELECT … FROM subscriptions WHERE status = 'TRIAL' AND stripe_subscription_id IS NULL`) e avise quem
  vence em breve.
- Acompanhe `billing_events` por falhas:
  `SELECT type, outcome, detail, created_at FROM billing_events WHERE outcome <> 'PROCESSED' ORDER BY created_at DESC;`
- No Dashboard, **Desenvolvedores → Webhooks** mostra entregas com erro; a conciliação horária corrige
  divergências de estado.
- **Reverter**: remova as quatro variáveis `STRIPE_*` e rode `docker compose up -d web worker`. A tela
  volta ao fluxo de solicitar mudança pelo suporte e a conciliação desliga. Nada local é perdido.

## 10. Limpeza do sandbox

- `stripe logout` em `glpi-srv` (as credenciais da CLI ficam sem criptografia).
- No sandbox, substitua a chave de teste que foi compartilhada em conversa ("Substituir chave").
- Cancele as assinaturas de exemplo criadas pelo `stripe trigger`.

## Fora do escopo deste roteiro

Boleto/Pix, nota fiscal da assinatura, carência depois do fim do trial e aviso permanente de bloqueio na
tela (ver `docs/stripe-billing.md`), além dos bloqueios jurídicos e contábeis de
`docs/commercial-launch-readiness.md`.
