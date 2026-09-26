import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listTransfers(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.transfer.findMany({
      where: { companyId },
      include: { fromAccount: true, toAccount: true },
      orderBy: { transferDate: "desc" },
    })
  );
}
