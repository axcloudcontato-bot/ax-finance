import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

/** Candidatas pro select manual de conciliação (Seção 12: "P0: confirmação manual de vínculo 1:1"). */
export async function listUnreconciledSettlements(userId: string, companyId: string, financialAccountId: string) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");

  return withCompanyContext(userId, companyId, (tx) =>
    tx.settlement.findMany({
      where: {
        companyId,
        financialAccountId,
        reversedAt: null,
        reconciledByLine: null,
      },
      include: { title: true },
      orderBy: { effectiveDate: "desc" },
    })
  );
}
