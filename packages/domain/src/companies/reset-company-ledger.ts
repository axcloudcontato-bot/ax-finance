import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "./permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CompanyResetConfirmationError } from "../errors";

export const resetCompanyLedgerInput = z.object({
  /** Nome da empresa digitado pelo proprietário; precisa bater exatamente. */
  confirmation: z.string(),
});

const RESET_REASON = "Reset da conta pelo proprietário";

/**
 * Zera os lançamentos da empresa SEM apagar nada (Seção 18 regras 7 e 10):
 * baixas, devoluções, transferências e ajustes são estornados, os títulos
 * saem das telas (soft delete), as regras recorrentes são canceladas e os
 * fechamentos de período são reabertos. Contas financeiras (com saldo de
 * abertura), categorias, clientes/fornecedores, centros de custo, usuários e
 * assinatura permanecem. Linhas de extrato conciliadas voltam a pendentes.
 *
 * Tudo numa só transação junto com o evento de auditoria: ou zera e registra,
 * ou nada acontece. Só o proprietário (MEMBERS_MANAGE) pode executar.
 */
export async function resetCompanyLedger(userId: string, companyId: string, input: unknown) {
  const data = resetCompanyLedgerInput.parse(input);
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    if (data.confirmation.trim() !== company.name) {
      throw new CompanyResetConfirmationError();
    }

    const now = new Date();
    const reversal = { reversedAt: now, reversalReason: RESET_REASON };

    const refunds = await tx.settlementRefund.updateMany({ where: { companyId, reversedAt: null }, data: reversal });
    const settlements = await tx.settlement.updateMany({ where: { companyId, reversedAt: null }, data: reversal });
    const transfers = await tx.transfer.updateMany({ where: { companyId, reversedAt: null }, data: reversal });
    const adjustments = await tx.balanceAdjustment.updateMany({ where: { companyId, reversedAt: null }, data: reversal });

    const statementLines = await tx.bankStatementLine.updateMany({
      where: { companyId, status: "RECONCILED" },
      data: { status: "PENDING", reconciledSettlementId: null, ignoreReason: null },
    });

    const titles = await tx.title.updateMany({
      where: { companyId, deletedAt: null },
      data: { deletedAt: now, deletedByUserId: userId, deleteReason: RESET_REASON },
    });

    const recurrences = await tx.recurrenceRule.updateMany({
      where: { companyId, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });

    const closures = await tx.periodClosure.updateMany({
      where: { companyId, status: "CLOSED" },
      data: { status: "REOPENED", reopenedByUserId: userId, reopenedAt: now, reopenReason: RESET_REASON },
    });

    const summary = {
      titles: titles.count,
      settlements: settlements.count,
      refunds: refunds.count,
      transfers: transfers.count,
      balanceAdjustments: adjustments.count,
      statementLinesUnreconciled: statementLines.count,
      recurrenceRulesCancelled: recurrences.count,
      periodsReopened: closures.count,
    };

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_LEDGER_RESET",
      resourceType: "Company",
      resourceId: companyId,
      summary: RESET_REASON,
      metadata: summary,
    });

    return summary;
  });
}
