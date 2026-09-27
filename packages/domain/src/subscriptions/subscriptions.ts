import type { Prisma } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";

const TRIAL_DAYS = 14;

export async function createTrialSubscriptionInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  now = new Date()
) {
  const trialEndsAt = new Date(now);
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + TRIAL_DAYS);
  return tx.subscription.create({
    data: {
      companyId,
      status: "TRIAL",
      planCode: "TRIAL",
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
