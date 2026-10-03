import {
  applyStripeSubscriptionState,
  claimBillingEvent,
  finishBillingEvent,
  listReconcilableSubscriptions,
  type ReconcilableSubscription,
} from "./billing";
import {
  mapStripeSubscription,
  snapshotFromStripe,
  type MappedSubscriptionState,
  type PriceCatalog,
  type StripeSubscriptionLike,
} from "./stripe-state";

/** Só o que a conciliação usa da SDK, para testar sem rede. */
export interface StripeReconcileClient {
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionLike>;
    list(params: { customer: string; status: "all"; limit: number }): Promise<{ data: StripeSubscriptionLike[] }>;
  };
}

export interface BillingReconciliationSummary {
  checked: number;
  inSync: number;
  corrected: number;
  missingInProvider: number;
  failed: number;
}

const DRIFT_TOLERANCE_MS = 1000;

function sameInstant(a: Date | null, b: Date | null) {
  if (!a || !b) return a === b;
  return Math.abs(a.getTime() - b.getTime()) <= DRIFT_TOLERANCE_MS;
}

/** O que mudou entre o estado local e o confirmado na Stripe (vazio = em dia). */
export function describeBillingDrift(local: ReconcilableSubscription, remote: MappedSubscriptionState): string[] {
  const differences: string[] = [];
  if (local.status !== remote.status) differences.push(`status ${local.status} → ${remote.status}`);
  if (remote.planCode && local.planCode !== remote.planCode) differences.push(`plano ${local.planCode} → ${remote.planCode}`);
  if (remote.currentPeriodEnd && !sameInstant(local.currentPeriodEnd, remote.currentPeriodEnd)) differences.push("fim do ciclo");
  if (!sameInstant(local.cancellationEffectiveAt, remote.cancellationEffectiveAt)) differences.push("cancelamento efetivo");
  return differences;
}

/**
 * Localiza a assinatura na Stripe. Com vínculo, lê pelo id. Sem vínculo (o webhook do
 * primeiro pagamento se perdeu), procura entre as assinaturas do cliente a que leva o
 * companyId desta empresa nos metadados que nós gravamos no checkout.
 */
async function findRemoteSubscription(client: StripeReconcileClient, local: ReconcilableSubscription) {
  if (local.stripeSubscriptionId) return client.subscriptions.retrieve(local.stripeSubscriptionId);
  if (!local.stripeCustomerId) return null;
  const { data } = await client.subscriptions.list({ customer: local.stripeCustomerId, status: "all", limit: 10 });
  return data.find((candidate) => candidate.metadata?.companyId === local.companyId) ?? null;
}

function isResourceMissing(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "resource_missing";
}

/**
 * Compara cada assinatura local ligada à Stripe com o estado do provedor e corrige o que
 * divergiu (DIRECAO §21: job periódico compara cobranças locais e provedor). Cobre
 * webhook perdido ou atrasado. Usa a mesma gravação do webhook, com a proteção contra
 * estado mais antigo, então rodar junto com um webhook é seguro. Cada correção deixa uma
 * linha em billing_events e um evento de auditoria; falha em uma assinatura não impede as
 * demais.
 */
export async function reconcileStripeSubscriptions(
  client: StripeReconcileClient,
  catalog: PriceCatalog,
  options: { limit?: number; now?: () => Date } = {}
): Promise<BillingReconciliationSummary> {
  const now = options.now ?? (() => new Date());
  const summary: BillingReconciliationSummary = { checked: 0, inSync: 0, corrected: 0, missingInProvider: 0, failed: 0 };

  for (const local of await listReconcilableSubscriptions(options.limit ?? 200)) {
    summary.checked += 1;
    try {
      const observedAt = now();
      const remote = await findRemoteSubscription(client, local);
      if (!remote) {
        summary.missingInProvider += 1;
        continue;
      }

      const snapshot = snapshotFromStripe(remote);
      const state = mapStripeSubscription(snapshot, catalog, observedAt);
      const differences = describeBillingDrift(local, state);
      if (differences.length === 0 && local.stripeSubscriptionId) {
        summary.inSync += 1;
        continue;
      }

      const applied = await applyStripeSubscriptionState({
        companyId: local.companyId,
        customerId: snapshot.customerId,
        subscriptionId: snapshot.id,
        state,
        observedAt,
      });

      const eventId = `reconcile:${local.companyId}:${observedAt.toISOString()}`;
      if (await claimBillingEvent(eventId, "reconciliation.drift")) {
        const detail = local.stripeSubscriptionId ? differences.join("; ") : "assinatura localizada pelo cliente (webhook não chegou)";
        await finishBillingEvent(eventId, "PROCESSED", {
          companyId: local.companyId,
          message: applied ? detail : `${detail} (não aplicado: estado mais novo ou conta interna)`,
        });
      }
      if (applied) summary.corrected += 1;
      else summary.inSync += 1;
    } catch (error) {
      if (isResourceMissing(error)) {
        summary.missingInProvider += 1;
      } else {
        summary.failed += 1;
        const eventId = `reconcile-error:${local.companyId}:${now().toISOString()}`;
        if (await claimBillingEvent(eventId, "reconciliation.error").catch(() => false)) {
          await finishBillingEvent(eventId, "FAILED", {
            companyId: local.companyId,
            message: error instanceof Error ? error.message : "erro desconhecido",
          }).catch(() => undefined);
        }
      }
    }
  }

  return summary;
}
