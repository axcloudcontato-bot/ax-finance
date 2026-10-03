import Stripe from "stripe";
import type { PriceCatalog, StripeSubscriptionSnapshot } from "@ax-finance/domain";

/**
 * Configuração da Stripe, lida do ambiente. Nada é obrigatório em desenvolvimento:
 * sem as chaves a tela de assinatura volta ao fluxo "solicitar mudança pelo suporte".
 *
 *   STRIPE_SECRET_KEY        chave secreta (sk_test_… / sk_live_…), só no servidor
 *   STRIPE_WEBHOOK_SECRET    segredo de assinatura do endpoint (whsec_…)
 *   STRIPE_PRICE_PERSONAL    id do preço mensal do plano Gestão Pessoal (price_…)
 *   STRIPE_PRICE_ESSENTIAL   id do preço mensal do plano Essencial (price_…)
 */
export function priceCatalog(): PriceCatalog {
  return {
    PERSONAL: process.env.STRIPE_PRICE_PERSONAL || undefined,
    ESSENTIAL: process.env.STRIPE_PRICE_ESSENTIAL || undefined,
  };
}

export function stripeConfigured(): boolean {
  const catalog = priceCatalog();
  return Boolean(process.env.STRIPE_SECRET_KEY && catalog.PERSONAL && catalog.ESSENTIAL);
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("A cobrança por cartão ainda não está configurada neste ambiente.");
  client ??= new Stripe(key, { appInfo: { name: "AX Finance" }, maxNetworkRetries: 2 });
  return client;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** O fim do ciclo vem dos itens da assinatura (API atual); vale o mais próximo. */
export function toSubscriptionSnapshot(subscription: Stripe.Subscription): StripeSubscriptionSnapshot {
  const items = subscription.items?.data ?? [];
  const periodEnds = items.map((item) => item.current_period_end).filter((value): value is number => typeof value === "number");
  return {
    id: subscription.id,
    customerId: idOf(subscription.customer) ?? "",
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: periodEnds.length > 0 ? Math.min(...periodEnds) : null,
    trialEnd: subscription.trial_end,
    cancelAt: subscription.cancel_at,
    priceId: items[0]?.price?.id ?? null,
    companyHint: subscription.metadata?.companyId || null,
  };
}

/** Id da assinatura a que o evento se refere, ou null quando o evento não é de cobrança. */
export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end":
      return event.data.object.id;
    case "checkout.session.completed": {
      const session = event.data.object;
      return session.mode === "subscription" ? idOf(session.subscription) : null;
    }
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
      return idOf(event.data.object.parent?.subscription_details?.subscription);
    default:
      return null;
  }
}

/**
 * Mantém a Stripe alinhada ao agendamento de cancelamento local: sem isto a cobrança
 * continuaria depois da data efetiva. Não faz nada quando a empresa ainda não tem
 * assinatura paga; se tem e a cobrança não está configurada, recusa.
 */
export async function setStripeCancelAtPeriodEnd(subscriptionId: string | null | undefined, cancel: boolean) {
  if (!subscriptionId) return;
  if (!stripeConfigured()) {
    // Cancelar só localmente deixaria a Stripe cobrando; melhor recusar do que divergir.
    throw new Error("A cobrança não está acessível agora. Tente de novo em instantes ou fale com o suporte.");
  }
  await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
}

/**
 * Texto seguro para a tela. Erros da própria aplicação já têm mensagem pensada para o
 * usuário; os da Stripe (em inglês, às vezes com trechos de chave ou de requisição)
 * só vão para o log do servidor.
 */
export function userFacingBillingError(error: unknown, fallback: string): string {
  if (error instanceof Error && !(error instanceof Stripe.errors.StripeError)) return error.message;
  console.error("[billing]", error);
  return fallback;
}
