import type Stripe from "stripe";
import {
  applyStripeSubscriptionState,
  findBillingCompanyId,
  mapStripeSubscription,
  type BillingEventOutcome,
} from "@ax-finance/domain";
import { priceCatalog, subscriptionIdFromEvent, toSubscriptionSnapshot } from "./stripe";

export interface StripeEventResult {
  outcome: BillingEventOutcome;
  companyId?: string | null;
  detail?: string;
}

/** Só o que o processamento usa da SDK, para testar sem rede. */
export interface SubscriptionReader {
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
}

/**
 * Processa um evento já autenticado (assinatura verificada). O corpo do evento é só
 * um aviso: o estado aplicado vem de uma leitura nova da assinatura na Stripe
 * (DIRECAO §21: confirmar no provedor e tratar eventos fora de ordem). Reentregas e
 * eventos fora de ordem convergem para o mesmo estado.
 */
export async function processStripeEvent(
  stripe: SubscriptionReader,
  event: Stripe.Event,
  now = () => new Date()
): Promise<StripeEventResult> {
  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) return { outcome: "IGNORED", detail: `evento ${event.type} não altera a assinatura` };

  const observedAt = now();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const snapshot = toSubscriptionSnapshot(subscription);
  if (!snapshot.customerId) return { outcome: "FAILED", detail: "assinatura sem cliente na Stripe" };

  const companyId = await findBillingCompanyId({
    customerId: snapshot.customerId,
    subscriptionId: snapshot.id,
    companyHint: snapshot.companyHint,
  });
  if (!companyId) {
    // Sem dica nossa nos metadados: é uma assinatura de outro produto da mesma conta Stripe.
    return snapshot.companyHint
      ? { outcome: "FAILED", detail: "empresa da assinatura não encontrada" }
      : { outcome: "IGNORED", detail: "assinatura sem vínculo com empresa" };
  }

  const state = mapStripeSubscription(snapshot, priceCatalog(), observedAt);
  const applied = await applyStripeSubscriptionState({
    companyId,
    customerId: snapshot.customerId,
    subscriptionId: snapshot.id,
    state,
    observedAt,
  });

  return {
    outcome: "PROCESSED",
    companyId,
    detail: applied ? `${snapshot.status} → ${state.status}` : "não aplicado (estado mais novo ou conta interna)",
  };
}
