import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "./permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CompanyResetConfirmationError } from "../errors";

export const resetCompanyLedgerInput = z.object({
  /** Nome da empresa digitado pelo proprietário; precisa bater exatamente. */
  confirmation: z.string(),
});

export interface ResetCompanyLedgerFiles {
  /** Anexos de títulos: quem chama apaga os objetos do storage (LOCAL/S3). */
  attachments: { storageKey: string; storageBackend: "LOCAL" | "S3" }[];
  /** Arquivos de extratos importados: apagados com `deleteImportSource`. */
  imports: string[];
}

const LEDGER_NOTIFICATION_TYPES = ["TITLE_OVERDUE", "TITLE_DUE_TODAY", "TITLE_DUE_SOON", "WEEKLY_SUMMARY"] as const;

/**
 * Zera a empresa APAGANDO de verdade todos os lançamentos: títulos (inclusive
 * os já removidos das telas), baixas, devoluções, rateios, anexos, transferências,
 * ajustes de saldo, regras recorrentes, extratos importados e linhas de extrato,
 * fechamentos de período, chaves de idempotência e lembretes financeiros.
 * Irreversível — por decisão do proprietário, esta é a única operação que foge da
 * regra de nunca apagar lançamento (Seção 18).
 *
 * Permanecem: contas financeiras (com saldo de abertura), categorias, clientes e
 * fornecedores, centros de custo, usuários, assinatura e a trilha de auditoria
 * (imutável por desenho do banco), onde fica o evento COMPANY_LEDGER_RESET.
 *
 * Tudo numa só transação junto com o evento de auditoria; só o proprietário
 * (MEMBERS_MANAGE) executa. Devolve as chaves de arquivos para o chamador limpar
 * o storage depois do commit.
 */
export async function resetCompanyLedger(userId: string, companyId: string, input: unknown) {
  const data = resetCompanyLedgerInput.parse(input);
  await assertCompanyPermission(userId, companyId, "MEMBERS_MANAGE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    if (data.confirmation.trim() !== company.name) {
      throw new CompanyResetConfirmationError();
    }

    const [attachmentRows, batchRows] = await Promise.all([
      tx.attachment.findMany({ where: { companyId }, select: { storageKey: true, storageBackend: true } }),
      tx.importBatch.findMany({ where: { companyId, storageKey: { not: null } }, select: { storageKey: true } }),
    ]);

    // Ordem imposta pelas chaves estrangeiras (todas RESTRICT): quem aponta primeiro.
    const statementLines = await tx.bankStatementLine.deleteMany({ where: { companyId } });
    const importBatches = await tx.importBatch.deleteMany({ where: { companyId } }); // ImportJob cai em cascata
    const refunds = await tx.settlementRefund.deleteMany({ where: { companyId } });
    const settlements = await tx.settlement.deleteMany({ where: { companyId } });
    const titles = await tx.title.deleteMany({ where: { companyId } }); // rateios e anexos caem em cascata
    const recurrences = await tx.recurrenceRule.deleteMany({ where: { companyId } });
    const transfers = await tx.transfer.deleteMany({ where: { companyId } });
    const adjustments = await tx.balanceAdjustment.deleteMany({ where: { companyId } });
    const closures = await tx.periodClosure.deleteMany({ where: { companyId } });
    await tx.idempotencyRecord.deleteMany({ where: { companyId } });
    await tx.notification.deleteMany({ where: { companyId, type: { in: [...LEDGER_NOTIFICATION_TYPES] } } });

    const summary = {
      titles: titles.count,
      settlements: settlements.count,
      refunds: refunds.count,
      transfers: transfers.count,
      balanceAdjustments: adjustments.count,
      statementLines: statementLines.count,
      importBatches: importBatches.count,
      recurrenceRules: recurrences.count,
      periodClosures: closures.count,
    };

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "COMPANY_LEDGER_RESET",
      resourceType: "Company",
      resourceId: companyId,
      summary: "Lançamentos apagados pelo proprietário",
      metadata: { ...summary, attachments: attachmentRows.length },
    });

    const files: ResetCompanyLedgerFiles = {
      attachments: attachmentRows.map((row) => ({
        storageKey: row.storageKey,
        storageBackend: row.storageBackend === "S3" ? "S3" : "LOCAL",
      })),
      imports: batchRows.flatMap((row) => (row.storageKey ? [row.storageKey] : [])),
    };

    return { ...summary, files };
  });
}
