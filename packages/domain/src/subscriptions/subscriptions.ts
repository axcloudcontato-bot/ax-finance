import type { Prisma } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { SubscriptionCancellationInvalidError } from "../errors";
import { recordAuditEvent } from "../audit/record-audit-event";
import type { SelectablePlanCode } from "./plan-features";

const TRIAL_DAYS = 14;

export async function createTrialSubscriptionInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  planCode: SelectablePlanCode = "ESSENTIAL",
  now = new Date()
) {
  const trialEndsAt = new Date(now);
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + TRIAL_DAYS);
  return tx.subscription.create({
    data: {
      companyId,
      status: "TRIAL",
      planCode,
      trialEndsAt,
    },
  });
}

export async function getCompanySubscription(userId: string, companyId: string) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, (tx) => tx.subscription.findUnique({
    where: { companyId },
  }));
}

export async function scheduleSubscriptionCancellation(userId: string, companyId: string, now = new Date()) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { companyId } });
    if (!subscription || subscription.status === "CANCELLED") throw new SubscriptionCancellationInvalidError();
    const candidates = [subscription.currentPeriodEnd, subscription.trialEndsAt].filter((date): date is Date => !!date && date > now);
    const effectiveAt = candidates.sort((a, b) => a.getTime() - b.getTime())[0] ?? now;
    const updated = await tx.subscription.update({ where: { companyId }, data: { status: "CANCELLATION_SCHEDULED", cancellationEffectiveAt: effectiveAt } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "SUBSCRIPTION_CANCELLATION_SCHEDULED", resourceType: "Subscription", resourceId: updated.id, summary: `Cancelamento agendado para ${effectiveAt.toISOString().slice(0, 10)}` });
    return updated;
  });
}

export async function undoSubscriptionCancellation(userId: string, companyId: string, now = new Date()) {
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { companyId } });
    if (!subscription || subscription.status !== "CANCELLATION_SCHEDULED" || (subscription.cancellationEffectiveAt && subscription.cancellationEffectiveAt <= now)) throw new SubscriptionCancellationInvalidError();
    const restoredStatus = subscription.trialEndsAt && subscription.trialEndsAt > now ? "TRIAL" : "ACTIVE";
    const updated = await tx.subscription.update({ where: { companyId }, data: { status: restoredStatus, cancellationEffectiveAt: null } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "SUBSCRIPTION_CANCELLATION_REVOKED", resourceType: "Subscription", resourceId: updated.id, summary: "Agendamento de cancelamento removido" });
    return updated;
  });
}
