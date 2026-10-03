import Stripe from "stripe";
import {
  logOperationalError,
  priceCatalogFromEnv,
  reconcileStripeSubscriptions,
  structuredLog,
  type BillingReconciliationSummary,
  type StripeReconcileClient,
} from "@ax-finance/domain";

/** A conciliação só roda com a Stripe configurada no ambiente do worker. */
export function billingReconciliationEnabled(env: Record<string, string | undefined> = process.env) {
  const catalog = priceCatalogFromEnv(env);
  return Boolean(env.STRIPE_SECRET_KEY && catalog.PERSONAL && catalog.ESSENTIAL);
}

/** Intervalo entre conciliações; no mínimo 1 minuto, padrão 1 hora. */
export function billingReconciliationIntervalMs(env: Record<string, string | undefined> = process.env) {
  return Math.max(60_000, Number(env.BILLING_RECONCILE_INTERVAL_MS || 60 * 60 * 1000));
}

let client: Stripe | null = null;

function stripeClient() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: "AX Finance worker" }, maxNetworkRetries: 2 });
  return client;
}

export async function runBillingReconciliation(
  reader: StripeReconcileClient = stripeClient() as unknown as StripeReconcileClient
): Promise<BillingReconciliationSummary> {
  return reconcileStripeSubscriptions(reader, priceCatalogFromEnv());
}

/**
 * Chamada pelo laço do worker. Nunca lança: falha de conciliação não pode derrubar o
 * processamento de e-mails, importações e jobs agendados; fica no log estruturado.
 */
export async function maybeRunBillingReconciliation(
  state: { lastRun: number },
  now = Date.now(),
  run: () => Promise<BillingReconciliationSummary> = runBillingReconciliation
) {
  if (!billingReconciliationEnabled()) return null;
  if (now - state.lastRun < billingReconciliationIntervalMs()) return null;
  state.lastRun = now;
  try {
    const summary = await run();
    structuredLog(summary.failed > 0 || summary.corrected > 0 ? "warn" : "info", "worker.billing_reconciliation_completed", { ...summary });
    return summary;
  } catch (error) {
    logOperationalError("worker.billing_reconciliation_failed", error);
    return null;
  }
}
