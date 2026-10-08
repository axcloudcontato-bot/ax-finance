import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { OPERATIONAL_ACCOUNT } from "./operational";

export async function listFinancialAccounts(userId: string, companyId: string, includeArchived = false) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.financialAccount.findMany({
      where: { companyId, ...OPERATIONAL_ACCOUNT, ...(includeArchived ? {} : { status: "ACTIVE" }) },
      orderBy: { createdAt: "asc" },
    })
  );
}
