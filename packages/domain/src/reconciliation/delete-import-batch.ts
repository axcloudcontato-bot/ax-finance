import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { ImportBatchHasWorkedLinesError, ImportBatchInProgressError, ImportBatchNotFoundError } from "../errors";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { deleteImportSource } from "./import-storage";

/**
 * Remove uma importação de extrato:
 *  - aguardando confirmação (PREVIEW): descarta; não gerou nenhuma linha, só apaga o arquivo enviado;
 *  - falha (FAILED): tira o registro da lista;
 *  - concluída (COMPLETED): apaga também as linhas que ela trouxe, mas SÓ se todas ainda estiverem
 *    pendentes. Linha conciliada ou ignorada já carrega uma decisão da pessoa e um vínculo com baixa:
 *    nesse caso a remoção é recusada até a pessoa desfazer essas decisões.
 * Na fila ou em processamento não dá para remover (o worker está trabalhando nela).
 *
 * Nada financeiro é alterado: baixas, saldos e títulos não dependem do extrato. Como as linhas somem,
 * reimportar o mesmo arquivo volta a trazê-las. Fica registro na auditoria.
 */
export async function deleteBankImportBatch(userId: string, companyId: string, batchId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  await assertCompanyPlanFeature(userId, companyId, "BANK_RECONCILIATION");

  const result = await withCompanyContext(userId, companyId, async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, companyId } });
    if (!batch) throw new ImportBatchNotFoundError();
    if (batch.status === "QUEUED" || batch.status === "PROCESSING") throw new ImportBatchInProgressError();

    let removedLines = 0;
    if (batch.status === "COMPLETED") {
      const worked = await tx.bankStatementLine.count({
        where: { importBatchId: batch.id, companyId, status: { not: "PENDING" } },
      });
      if (worked > 0) throw new ImportBatchHasWorkedLinesError();
      removedLines = (await tx.bankStatementLine.deleteMany({ where: { importBatchId: batch.id, companyId } })).count;
    }

    // Se o estado mudou entre a leitura e aqui (ex.: confirmada em outra aba), nada é apagado e a transação desfaz tudo.
    const deleted = await tx.importBatch.deleteMany({ where: { id: batch.id, companyId, status: batch.status } });
    if (deleted.count !== 1) throw new ImportBatchInProgressError();

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "BANK_IMPORT_DELETED",
      resourceType: "ImportBatch",
      resourceId: batch.id,
      summary: batch.fileName,
      metadata: { status: batch.status, removedLines, financialAccountId: batch.financialAccountId },
    });
    return { fileName: batch.fileName, financialAccountId: batch.financialAccountId, storageKey: batch.storageKey, removedLines };
  });

  // Depois do commit: o arquivo temporário (só existe enquanto aguardava confirmação). Falhar aqui não desfaz a remoção.
  if (result.storageKey) await deleteImportSource(result.storageKey).catch(() => undefined);
  return result;
}
