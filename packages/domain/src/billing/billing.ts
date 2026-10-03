import { prisma, withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import type { MappedSubscriptionState } from "./stripe-state";

/**
 * O webhook chega sem usuário logado, então não passa pelo RLS por empresa: ele só
 * alcança billing_events e subscriptions pelas funções SECURITY DEFINER app_billing_*
 * (migration 20261003120000_stripe_billing), que validam e gravam o mínimo necessário.
 */

export type BillingEventOutcome = "PROCESSED" | "IGNORED" | "FAILED";

/** Reserva o evento da Stripe; falso quando ele já foi processado ou ignorado. */
export async function claimBillingEvent(eventId: string, type: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ claimed: boolean }[]>`
    SELECT app_billing_claim_event(${eventId}, ${type}) AS claimed
  `;
  return rows[0]?.claimed === true;
}

export async function finishBillingEvent(
  eventId: string,
  outcome: BillingEventOutcome,
  detail: { companyId?: string | null; message?: string | null } = {}
): Promise<void> {
  // ::text porque o Prisma não lê colunas do tipo void.
  await prisma.$queryRaw`
    SELECT app_billing_finish_event(${eventId}, ${outcome}, ${detail.companyId ?? null}, ${detail.message ?? null})::text AS done
  `;
}

export async function findBillingCompanyId(input: {
  customerId: string | null;
  subscriptionId: string | null;
  companyHint: string | null;
}): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ company_id: string | null }[]>`
    SELECT app_billing_find_company(${input.customerId}, ${input.subscriptionId}, ${input.companyHint}) AS company_id
  `;
  return rows[0]?.company_id ?? null;
}

/** Instante como timestamp UTC, sem depender do fuso da sessão do Postgres. */
function utcTimestamp(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

/**
 * Grava o estado confirmado na Stripe. `observedAt` é o instante em que o estado foi
 * lido do provedor: um estado lido antes de outro já aplicado é descartado.
 */
export async function applyStripeSubscriptionState(input: {
  companyId: string;
  customerId: string;
  subscriptionId: string;
  state: MappedSubscriptionState;
  observedAt?: Date;
}): Promise<boolean> {
  const { state } = input;
  const rows = await prisma.$queryRaw<{ applied: boolean }[]>`
    SELECT app_billing_apply(
      ${input.companyId},
      ${input.customerId},
      ${input.subscriptionId},
      ${state.status},
      ${state.planCode},
      ${utcTimestamp(state.trialEndsAt)}::timestamptz AT TIME ZONE 'UTC',
      ${utcTimestamp(state.currentPeriodEnd)}::timestamptz AT TIME ZONE 'UTC',
      ${utcTimestamp(state.graceEndsAt)}::timestamptz AT TIME ZONE 'UTC',
      ${utcTimestamp(state.cancellationEffectiveAt)}::timestamptz AT TIME ZONE 'UTC',
      ${utcTimestamp(input.observedAt ?? new Date())}::timestamptz AT TIME ZONE 'UTC'
    ) AS applied
  `;
  return rows[0]?.applied === true;
}

/** Guarda o cliente da Stripe da empresa (criado no primeiro checkout). */
export async function linkStripeCustomer(userId: string, companyId: string, customerId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const updated = await tx.subscription.update({
      where: { companyId },
      data: { stripeCustomerId: customerId },
    });
    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "SUBSCRIPTION_BILLING_CUSTOMER_LINKED",
      resourceType: "Subscription",
      resourceId: updated.id,
      summary: "Cliente de cobrança criado na Stripe",
    });
    return updated;
  });
}

export interface ReconcilableSubscription {
  companyId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  planCode: string;
  currentPeriodEnd: Date | null;
  cancellationEffectiveAt: Date | null;
}

/** Assinaturas a conferir com a Stripe, as mais antigas sem sincronização primeiro. */
export async function listReconcilableSubscriptions(limit = 200): Promise<ReconcilableSubscription[]> {
  const rows = await prisma.$queryRaw<
    {
      company_id: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      status: string;
      plan_code: string;
      current_period_end: Date | null;
      cancellation_effective_at: Date | null;
    }[]
  >`SELECT * FROM app_billing_list_reconcilable(${limit}::integer)`;
  return rows.map((row) => ({
    companyId: row.company_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    planCode: row.plan_code,
    currentPeriodEnd: row.current_period_end,
    cancellationEffectiveAt: row.cancellation_effective_at,
  }));
}
