import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import {
  BankStatementLineAlreadyProcessedError,
  BankStatementLineNotFoundError,
  SettlementAlreadyReconciledError,
  SettlementNotFoundError,
} from "../errors";

export const reconcileBankStatementLineInput = z.object({
  settlementId: z.string().uuid(),
});

/**
 * Vínculo manual 1:1 (Seção 12). A baixa precisa ser da mesma conta da
 * linha; a constraint única em bank_statement_lines.reconciled_settlement_id
 * já impede duas linhas apontarem pra mesma baixa a nível de banco, mas
 * confere aqui antes pra devolver um erro de domínio claro em vez do erro
 * cru do Postgres.
 */
export async function reconcileBankStatementLine(userId: string, companyId: string, lineId: string, input: unknown) {
  const data = reconcileBankStatementLineInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
    if (!line) {
      throw new BankStatementLineNotFoundError();
    }
    if (line.status !== "PENDING") {
      throw new BankStatementLineAlreadyProcessedError();
    }

    const settlement = await tx.settlement.findFirst({
      where: { id: data.settlementId, companyId, financialAccountId: line.financialAccountId, reversedAt: null },
    });
    if (!settlement) {
      throw new SettlementNotFoundError();
    }

    const alreadyReconciled = await tx.bankStatementLine.findFirst({
      where: { reconciledSettlementId: data.settlementId },
    });
    if (alreadyReconciled) {
      throw new SettlementAlreadyReconciledError();
    }

    return tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "RECONCILED", reconciledSettlementId: data.settlementId, ignoreReason: null },
    });
  });
}
