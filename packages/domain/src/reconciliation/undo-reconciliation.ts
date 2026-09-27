import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { BankStatementLineNotFoundError } from "../errors";

/** Seção 12: "Desfazer conciliação rompe vínculo auditado, não apaga automaticamente o movimento real." */
export async function undoReconciliation(userId: string, companyId: string, lineId: string) {
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
    if (!line) {
      throw new BankStatementLineNotFoundError();
    }

    return tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "PENDING", reconciledSettlementId: null, ignoreReason: null },
    });
  });
}
