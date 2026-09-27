import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { FinancialAccountNotFoundError } from "../errors";
import { parseBankStatementContent } from "./bank-statement-parser";

export const importBankStatementInput = z.object({
  financialAccountId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  csvContent: z.string().min(1),
});

export type ImportBankStatementInput = z.infer<typeof importBankStatementInput>;

/**
 * Compatibilidade com o fluxo original e integrações internas: importa um CSV
 * com cabeçalhos data/descricao/valor em uma única chamada. A interface web
 * usa o fluxo novo de preview + confirmação.
 */
export async function importBankStatement(userId: string, companyId: string, input: unknown) {
  const data = importBankStatementInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  const parsed = parseBankStatementContent("CSV", data.csvContent, {
    dateColumn: "data",
    descriptionColumn: "descricao",
    amountColumn: "valor",
  });

  const batch = await withCompanyContext(userId, companyId, async (tx) => {
    const account = await tx.financialAccount.findFirst({
      where: { id: data.financialAccountId, companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!account) throw new FinancialAccountNotFoundError();

    const created = await tx.importBatch.create({
      data: {
        companyId,
        financialAccountId: data.financialAccountId,
        fileName: data.fileName,
        fileFormat: "CSV",
        status: "PROCESSING",
        rowCount: parsed.totalRows,
        importedCount: 0,
        duplicateCount: 0,
        invalidCount: parsed.invalidRows.length,
        startedAt: new Date(),
      },
    });
    const inserted = await tx.bankStatementLine.createMany({
      data: parsed.rows.map((row) => ({
        companyId,
        financialAccountId: data.financialAccountId,
        importBatchId: created.id,
        lineDate: new Date(`${row.lineDate}T00:00:00Z`),
        description: row.description,
        amountCents: row.amountCents,
        dedupKey: row.dedupKey,
      })),
      skipDuplicates: true,
    });
    return tx.importBatch.update({
      where: { id: created.id },
      data: {
        status: "COMPLETED",
        importedCount: inserted.count,
        duplicateCount: parsed.rows.length - inserted.count,
        completedAt: new Date(),
      },
    });
  });

  return { batch, invalidRows: parsed.invalidRows };
}
