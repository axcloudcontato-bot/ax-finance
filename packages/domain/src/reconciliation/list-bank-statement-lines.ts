import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

export interface ListBankStatementLinesFilter {
  financialAccountId?: string;
  status?: "PENDING" | "RECONCILED" | "IGNORED";
  from?: string;
  to?: string;
}

export async function listBankStatementLines(
  userId: string,
  companyId: string,
  filter: ListBankStatementLinesFilter = {}
) {
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");

  return withCompanyContext(userId, companyId, (tx) =>
    tx.bankStatementLine.findMany({
      where: {
        companyId,
        ...(filter.financialAccountId ? { financialAccountId: filter.financialAccountId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...((filter.from || filter.to) ? {
          lineDate: {
            ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
            ...(filter.to ? { lte: new Date(`${filter.to}T00:00:00Z`) } : {}),
          },
        } : {}),
      },
      include: {
        reconciledSettlement: { include: { title: true } },
      },
      orderBy: { lineDate: "desc" },
    })
  );
}
