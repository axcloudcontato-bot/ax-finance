import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

export async function listImportBatches(userId: string, companyId: string, financialAccountId?: string) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");

  return withCompanyContext(userId, companyId, (tx) =>
    tx.importBatch.findMany({
      where: { companyId, ...(financialAccountId ? { financialAccountId } : {}) },
      orderBy: { createdAt: "desc" },
    })
  );
}
