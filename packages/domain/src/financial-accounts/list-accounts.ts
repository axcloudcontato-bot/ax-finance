import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listFinancialAccounts(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.financialAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    })
  );
}
