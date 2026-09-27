import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListBalanceAdjustmentsFilter {
  financialAccountId?: string;
  from?: string;
  to?: string;
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
        ...((filter.from || filter.to) ? {
          effectiveDate: {
            ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
            ...(filter.to ? { lte: new Date(`${filter.to}T00:00:00Z`) } : {}),
          },
        } : {}),
      },
      include: { financialAccount: { select: { name: true, currency: true } } },
      orderBy: { createdAt: "desc" },
    })
  );
}
