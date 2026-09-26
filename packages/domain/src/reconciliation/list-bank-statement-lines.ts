import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListBankStatementLinesFilter {
  financialAccountId?: string;
  status?: "PENDING" | "RECONCILED" | "IGNORED";
}

export async function listBankStatementLines(
  userId: string,
  companyId: string,
  filter: ListBankStatementLinesFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.bankStatementLine.findMany({
      where: {
        companyId,
        ...(filter.financialAccountId ? { financialAccountId: filter.financialAccountId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: {
        reconciledSettlement: { include: { title: true } },
      },
      orderBy: { lineDate: "desc" },
    })
  );
}
