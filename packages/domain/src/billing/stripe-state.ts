import type { SelectablePlanCode } from "../subscriptions/plan-features";

/** Carência operacional inicial depois da primeira falha de cobrança (DIRECAO §21). */
export const BILLING_GRACE_DAYS = 7;

/** Subconjunto do objeto Subscription da Stripe de que o domínio precisa. */
export interface StripeSubscriptionSnapshot {
  id: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Epoch em segundos, como a Stripe envia. */
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  cancelAt: number | null;
  priceId: string | null;
  /** companyId gravado por nós nos metadados do checkout. */
  companyHint: string | null;
}

export type BillingSubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAYMENT_PENDING"
  | "SUSPENDED"
  | "CANCELLATION_SCHEDULED"
  | "CANCELLED";

export interface MappedSubscriptionState {
  status: BillingSubscriptionStatus;
  planCode: SelectablePlanCode | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  cancellationEffectiveAt: Date | null;
}

export type PriceCatalog = Partial<Record<SelectablePlanCode, string>>;

/** Ids de preço mensal de cada plano, lidos do ambiente (web e worker usam o mesmo). */
export function priceCatalogFromEnv(env: Record<string, string | undefined> = process.env): PriceCatalog {
  return {
    PERSONAL: env.STRIPE_PRICE_PERSONAL || undefined,
    ESSENTIAL: env.STRIPE_PRICE_ESSENTIAL || undefined,
  };
}

/**
 * Forma mínima do objeto Subscription da Stripe (a SDK real satisfaz). Mantém o
 * domínio sem depender da SDK e deixa testar com objetos simples.
 */
export interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  trial_end: number | null;
  metadata?: Record<string, string> | null;
  items?: { data: { current_period_end?: number | null; price?: { id: string } | null }[] } | null;
}

/** O fim do ciclo vem dos itens da assinatura (API atual); vale o mais próximo. */
export function snapshotFromStripe(subscription: StripeSubscriptionLike): StripeSubscriptionSnapshot {
  const items = subscription.items?.data ?? [];
  const periodEnds = items
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return {
    id: subscription.id,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: periodEnds.length > 0 ? Math.min(...periodEnds) : null,
    trialEnd: subscription.trial_end,
    cancelAt: subscription.cancel_at,
    priceId: items[0]?.price?.id ?? null,
    companyHint: subscription.metadata?.companyId || null,
  };
}

function fromEpoch(value: number | null): Date | null {
  return value && value > 0 ? new Date(value * 1000) : null;
}

export function planCodeForPrice(priceId: string | null, catalog: PriceCatalog): SelectablePlanCode | null {
  if (!priceId) return null;
  const match = (Object.entries(catalog) as [SelectablePlanCode, string | undefined][]).find(([, id]) => id === priceId);
  return match ? match[0] : null;
}

/**
 * Traduz o estado da assinatura na Stripe para o ciclo local. O pagamento nunca é
 * dado como confirmado por outro caminho que não este (DIRECAO §21): active/trialing
 * vêm do provedor, não da volta do navegador.
 *
 * Mapeamento: trialing→TRIAL; active→ACTIVE; past_due/incomplete→PAYMENT_PENDING (com
 * carência de 7 dias); unpaid/paused→SUSPENDED; canceled/incomplete_expired→CANCELLED.
 * Agendamento de cancelamento (cancel_at_period_end ou cancel_at) vira
 * CANCELLATION_SCHEDULED enquanto a assinatura ainda estiver vigente.
 */
export function mapStripeSubscription(
  subscription: StripeSubscriptionSnapshot,
  catalog: PriceCatalog,
  now = new Date()
): MappedSubscriptionState {
  const currentPeriodEnd = fromEpoch(subscription.currentPeriodEnd);
  const trialEnd = fromEpoch(subscription.trialEnd);
  const cancelAt = fromEpoch(subscription.cancelAt);
  const scheduledCancel = subscription.cancelAtPeriodEnd || (cancelAt !== null && cancelAt > now);
  const cancellationEffectiveAt = scheduledCancel ? (cancelAt ?? currentPeriodEnd ?? trialEnd) : null;

  let status: BillingSubscriptionStatus;
  switch (subscription.status) {
    case "trialing":
      status = scheduledCancel ? "CANCELLATION_SCHEDULED" : "TRIAL";
      break;
    case "active":
      status = scheduledCancel ? "CANCELLATION_SCHEDULED" : "ACTIVE";
      break;
    case "past_due":
    case "incomplete":
      status = "PAYMENT_PENDING";
      break;
    case "unpaid":
    case "paused":
      status = "SUSPENDED";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "CANCELLED";
      break;
    default:
      // Estado desconhecido nunca libera nem corta acesso por suposição.
      status = "PAYMENT_PENDING";
  }

  const graceEndsAt = status === "PAYMENT_PENDING"
    ? new Date(now.getTime() + BILLING_GRACE_DAYS * 24 * 60 * 60 * 1000)
    : null;

  return {
    status,
    planCode: planCodeForPrice(subscription.priceId, catalog),
    trialEndsAt: subscription.status === "trialing" ? trialEnd : null,
    currentPeriodEnd,
    graceEndsAt,
    cancellationEffectiveAt: status === "CANCELLATION_SCHEDULED" || status === "CANCELLED"
      ? (status === "CANCELLED" ? (cancellationEffectiveAt ?? now) : cancellationEffectiveAt)
      : null,
  };
}
