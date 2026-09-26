import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

/** Candidatas pro select manual de conciliação (Seção 12: "P0: confirmação manual de vínculo 1:1"). */
export async function listUnreconciledSettlements(userId: string, companyId: string, financialAccountId: string) {
  await assertActiveMembership(userId, companyId);

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
