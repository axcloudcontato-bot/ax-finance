import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listImportBatches(userId: string, companyId: string, financialAccountId?: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.importBatch.findMany({
      where: { companyId, ...(financialAccountId ? { financialAccountId } : {}) },
      orderBy: { createdAt: "desc" },
    })
  );
}
