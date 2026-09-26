import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListBalanceAdjustmentsFilter {
  financialAccountId?: string;
}

export async function listBalanceAdjustments(
  userId: string,
  companyId: string,
  filter: ListBalanceAdjustmentsFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.balanceAdjustment.findMany({
      where: {
        companyId,
        ...(filter.financialAccountId ? { financialAccountId: filter.financialAccountId } : {}),
      },
      include: { financialAccount: { select: { name: true, currency: true } } },
      orderBy: { createdAt: "desc" },
    })
  );
}
