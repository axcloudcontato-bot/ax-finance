import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listTransfers(
  userId: string,
  companyId: string,
  filter: { from?: string; to?: string } = {}
) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.transfer.findMany({
      where: {
        companyId,
        ...((filter.from || filter.to) ? {
          transferDate: {
            ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
            ...(filter.to ? { lte: new Date(`${filter.to}T00:00:00Z`) } : {}),
          },
        } : {}),
      },
      include: { fromAccount: true, toAccount: true },
      orderBy: { transferDate: "desc" },
    })
  );
}
