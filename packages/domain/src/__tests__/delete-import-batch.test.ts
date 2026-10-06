import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { listBankStatementLines } from "../reconciliation/list-bank-statement-lines";
import { listImportBatches } from "../reconciliation/list-import-batches";
import { ignoreBankStatementLine } from "../reconciliation/ignore-bank-statement-line";
import { confirmBankImport, createBankImportPreview } from "../reconciliation/import-batches";
import { deleteBankImportBatch } from "../reconciliation/delete-import-batch";
import { listAuditEvents } from "../audit/list-audit-events";
import { ImportBatchHasWorkedLinesError, ImportBatchInProgressError, ImportBatchNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
  return { user, company, account };
}

const CSV = ["data,descricao,valor", "10/09/2026,Recebimento cliente A,\"500,00\"", "11/09/2026,Tarifa bancária,\"-25,00\""].join("\n");

async function preview(ctx: Awaited<ReturnType<typeof setup>>) {
  const batchId = randomUUID();
  await createBankImportPreview(ctx.user.id, ctx.company.id, {
    id: batchId,
    financialAccountId: ctx.account.id,
    fileName: "extrato.ofx",
    fileFormat: "OFX",
    fileSizeBytes: 1_000,
    storageKey: `${ctx.company.id}/${batchId}/source.ofx`,
    detectedRowCount: 2,
  });
  return batchId;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("remover importação de extrato", () => {
  it("descarta a importação que aguarda confirmação, sem linhas, e deixa registro na auditoria", async () => {
    const ctx = await setup("preview");
    const batchId = await preview(ctx);

    const removed = await deleteBankImportBatch(ctx.user.id, ctx.company.id, batchId);

    expect(removed).toMatchObject({ fileName: "extrato.ofx", financialAccountId: ctx.account.id, removedLines: 0 });
    expect(await listImportBatches(ctx.user.id, ctx.company.id)).toHaveLength(0);
    const events = await listAuditEvents(ctx.user.id, ctx.company.id, { resourceType: "ImportBatch", resourceId: batchId });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "BANK_IMPORT_DELETED", summary: "extrato.ofx" });
  });

  it("remove uma importação concluída com as linhas ainda pendentes, e reimportar traz as linhas de volta", async () => {
    const ctx = await setup("concluida");
    const first = await importBankStatement(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id, fileName: "extrato.csv", csvContent: CSV });
    expect(first.batch.importedCount).toBe(2);

    const removed = await deleteBankImportBatch(ctx.user.id, ctx.company.id, first.batch.id);
    expect(removed.removedLines).toBe(2);
    expect(await listBankStatementLines(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id })).toHaveLength(0);
    expect(await listImportBatches(ctx.user.id, ctx.company.id)).toHaveLength(0);

    const again = await importBankStatement(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id, fileName: "extrato.csv", csvContent: CSV });
    expect(again.batch).toMatchObject({ importedCount: 2, duplicateCount: 0 });
  });

  it("recusa remover quando alguma linha já foi ignorada (decisão da pessoa) e nada é apagado", async () => {
    const ctx = await setup("trabalhada");
    const imported = await importBankStatement(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id, fileName: "extrato.csv", csvContent: CSV });
    const [line] = await listBankStatementLines(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id });
    await ignoreBankStatementLine(ctx.user.id, ctx.company.id, line!.id, { reason: "Duplicada no banco" });

    await expect(deleteBankImportBatch(ctx.user.id, ctx.company.id, imported.batch.id)).rejects.toBeInstanceOf(ImportBatchHasWorkedLinesError);

    expect(await listBankStatementLines(ctx.user.id, ctx.company.id, { financialAccountId: ctx.account.id })).toHaveLength(2);
    expect(await listImportBatches(ctx.user.id, ctx.company.id)).toHaveLength(1);
  });

  it("não remove importação na fila ou em processamento", async () => {
    const ctx = await setup("fila");
    const batchId = await preview(ctx);
    await confirmBankImport(ctx.user.id, ctx.company.id, batchId, { processInBackground: true });

    await expect(deleteBankImportBatch(ctx.user.id, ctx.company.id, batchId)).rejects.toBeInstanceOf(ImportBatchInProgressError);
    expect(await listImportBatches(ctx.user.id, ctx.company.id)).toHaveLength(1);
  });

  it("não alcança importação de outra empresa", async () => {
    const mine = await setup("minha");
    const other = await setup("outra");
    const batchId = await preview(other);

    await expect(deleteBankImportBatch(mine.user.id, mine.company.id, batchId)).rejects.toBeInstanceOf(ImportBatchNotFoundError);
    expect(await listImportBatches(other.user.id, other.company.id)).toHaveLength(1);
  });
});
