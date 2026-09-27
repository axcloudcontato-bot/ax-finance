import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { listImportBatches } from "../reconciliation/list-import-batches";
import { listBankStatementLines } from "../reconciliation/list-bank-statement-lines";
import { listUnreconciledSettlements } from "../reconciliation/list-unreconciled-settlements";
import { reconcileBankStatementLine } from "../reconciliation/reconcile-bank-statement-line";
import { ignoreBankStatementLine } from "../reconciliation/ignore-bank-statement-line";
import { undoReconciliation } from "../reconciliation/undo-reconciliation";
import { parseAmountCents, parseBankStatementContent, previewBankStatement } from "../reconciliation/bank-statement-parser";
import {
  claimImportJobs,
  completeImportJob,
  confirmBankImport,
  createBankImportPreview,
  failImportJob,
  processBankImportBatch,
} from "../reconciliation/import-batches";
import { listNotifications } from "../notifications/notifications";
import { decodeImportFailedPayload } from "../outbox/events";
import { SettlementAlreadyReconciledError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompany(label: string) {
  const user = await registerUser({
    email: uniqueEmail(label),
    name: `Usuária ${label}`,
    password: "senha-forte-123",
  });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, {
    name: "Conta principal",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const category = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  return { user, company, account, category };
}

const SAMPLE_CSV = [
  "data,descricao,valor",
  "10/09/2026,Recebimento cliente A,500,00",
  "11/09/2026,Tarifa bancária,-25,00",
  "12/09/2026,Linha sem valor,",
].join("\n");

const CUSTOM_CSV = [
  "Quando;Histórico;Débito;Crédito",
  "15/09/2026;Mensalidade;;1.250,50",
  "16/09/2026;Tarifa;20,00;",
].join("\n");

const SAMPLE_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260917120000[-3:BRT]<TRNAMT>750.25<FITID>ofx-001<NAME>Cliente OFX<MEMO>Pagamento</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260918120000[-3:BRT]<TRNAMT>-15.90<FITID>ofx-002<NAME>Tarifa banco</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("importação de extrato (Seção 12)", () => {
  it("importa linhas válidas e reporta as inválidas", async () => {
    const { user, company, account } = await setupCompany("import");

    const result = await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato-setembro.csv",
      csvContent: SAMPLE_CSV,
    });

    expect(result.batch.rowCount).toBe(3);
    expect(result.batch.importedCount).toBe(2);
    expect(result.batch.duplicateCount).toBe(0);
    expect(result.batch.invalidCount).toBe(1);
    expect(result.invalidRows).toHaveLength(1);

    const lines = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id });
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.status === "PENDING")).toBe(true);
    const amounts = lines.map((line) => line.amountCents).sort();
    expect(amounts).toEqual([-2_500n, 50_000n]);
  });

  it("reimportar o mesmo arquivo não duplica — conta como duplicata", async () => {
    const { user, company, account } = await setupCompany("reimport");

    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: SAMPLE_CSV,
    });

    const second = await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: SAMPLE_CSV,
    });

    expect(second.batch.importedCount).toBe(0);
    expect(second.batch.duplicateCount).toBe(2);

    const lines = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id });
    expect(lines).toHaveLength(2);
  });

  it("sugere o mapeamento CSV e combina colunas separadas de débito/crédito", () => {
    const preview = previewBankStatement("extrato.csv", CUSTOM_CSV);
    expect(preview.suggestedMapping).toMatchObject({
      dateColumn: "Quando",
      descriptionColumn: "Histórico",
      debitColumn: "Débito",
      creditColumn: "Crédito",
    });
    const parsed = parseBankStatementContent("CSV", CUSTOM_CSV, {
      dateColumn: "Quando",
      descriptionColumn: "Histórico",
      debitColumn: "Débito",
      creditColumn: "Crédito",
    });
    expect(parsed.rows.map((row) => row.amountCents)).toEqual([125_050n, -2_000n]);
    expect(parseAmountCents("1.250")).toBe(125_000n);
    expect(parseAmountCents("1,250")).toBe(125_000n);
  });

  it("importa OFX e usa FITID na deduplicação", async () => {
    const { user, company, account } = await setupCompany("ofx");
    const parsed = parseBankStatementContent("OFX", SAMPLE_OFX);
    expect(parsed.rows).toMatchObject([
      { lineDate: "2026-09-17", amountCents: 75_025n, dedupKey: "ofx:ofx-001" },
      { lineDate: "2026-09-18", amountCents: -1_590n, dedupKey: "ofx:ofx-002" },
    ]);

    const batchId = randomUUID();
    await createBankImportPreview(user.id, company.id, {
      id: batchId,
      financialAccountId: account.id,
      fileName: "banco.ofx",
      fileFormat: "OFX",
      fileSizeBytes: Buffer.byteLength(SAMPLE_OFX),
      storageKey: `${company.id}/${batchId}/source.ofx`,
      detectedRowCount: 2,
    });
    await confirmBankImport(user.id, company.id, batchId, { processInBackground: false });
    const result = await processBankImportBatch(user.id, company.id, batchId, SAMPLE_OFX);
    expect(result).toMatchObject({ status: "COMPLETED", importedCount: 2, invalidCount: 0 });
  });

  it("processa arquivo grande pela fila e notifica conclusão", async () => {
    const { user, company, account } = await setupCompany("async");
    const batchId = randomUUID();
    await createBankImportPreview(user.id, company.id, {
      id: batchId,
      financialAccountId: account.id,
      fileName: "grande.csv",
      fileFormat: "CSV",
      fileSizeBytes: 600_000,
      storageKey: `${company.id}/${batchId}/source.csv`,
      detectedRowCount: 2,
    });
    await confirmBankImport(user.id, company.id, batchId, {
      processInBackground: true,
      mapping: { dateColumn: "Quando", descriptionColumn: "Histórico", debitColumn: "Débito", creditColumn: "Crédito" },
    });
    const [job] = await claimImportJobs("worker-import", 1);
    expect(job).toBeDefined();
    const result = await processBankImportBatch(user.id, company.id, batchId, CUSTOM_CSV);
    expect(result.importedCount).toBe(2);
    expect(await completeImportJob(job!, "worker-import")).toBe(true);
    expect((await listNotifications(user.id, company.id))[0]).toMatchObject({ type: "IMPORT_COMPLETED" });
  });

  it("notifica falha definitiva sem persistir a mensagem bruta", async () => {
    const { user, company, account } = await setupCompany("async-fail");
    const batchId = randomUUID();
    await createBankImportPreview(user.id, company.id, {
      id: batchId,
      financialAccountId: account.id,
      fileName: "invalido.csv",
      fileFormat: "CSV",
      fileSizeBytes: 600_000,
      storageKey: `${company.id}/${batchId}/source.csv`,
      detectedRowCount: 1,
    });
    await confirmBankImport(user.id, company.id, batchId, {
      processInBackground: true,
      mapping: { dateColumn: "data", descriptionColumn: "descricao", amountColumn: "valor" },
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const workerId = `worker-fail-${attempt}`;
      const [job] = await claimImportJobs(workerId, 1);
      expect(job).toBeDefined();
      const failure = await failImportJob(job!, workerId, new Error("arquivo com dado privado"));
      expect(failure.finalFailure).toBe(attempt === 3);
      if (attempt < 3) {
        await rootClient.importJob.update({ where: { id: job!.id }, data: { availableAt: new Date(0) } });
      }
    }
    const failed = await rootClient.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureCode).toMatch(/^Error:sha256_[a-f0-9]{12}$/);
    expect(failed.failureCode).not.toContain("privado");
    expect((await listNotifications(user.id, company.id))[0]).toMatchObject({ type: "IMPORT_FAILED" });
    const failedEmail = await rootClient.outboxEvent.findFirstOrThrow({ where: { type: "IMPORT_FAILED" } });
    expect(decodeImportFailedPayload(failedEmail)).toMatchObject({
      to: user.email,
      companyName: company.name,
    });
  });
});

describe("conciliação manual (Seção 12)", () => {
  it("concilia uma linha com uma baixa da mesma conta e bloqueia conciliar a mesma baixa de novo", async () => {
    const { user, company, account, category } = await setupCompany("reconcile");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço prestado",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-10",
    });

    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: SAMPLE_CSV,
    });

    const candidates = await listUnreconciledSettlements(user.id, company.id, account.id);
    expect(candidates.map((s) => s.id)).toEqual([settlement.id]);

    const lines = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id, status: "PENDING" });
    const matchingLine = lines.find((line) => line.amountCents === 50_000n)!;

    const reconciled = await reconcileBankStatementLine(user.id, company.id, matchingLine.id, {
      settlementId: settlement.id,
    });
    expect(reconciled.status).toBe("RECONCILED");

    const otherLine = lines.find((line) => line.id !== matchingLine.id)!;
    await expect(
      reconcileBankStatementLine(user.id, company.id, otherLine.id, { settlementId: settlement.id })
    ).rejects.toBeInstanceOf(SettlementAlreadyReconciledError);

    const stillUnreconciled = await listUnreconciledSettlements(user.id, company.id, account.id);
    expect(stillUnreconciled).toHaveLength(0);
  });

  it("ignora com motivo e desfazer volta pra pendente sem mexer na baixa", async () => {
    const { user, company, account, category } = await setupCompany("ignore-undo");

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço prestado",
      categoryId: category.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-10",
    });

    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "extrato.csv",
      csvContent: SAMPLE_CSV,
    });
    const lines = await listBankStatementLines(user.id, company.id, { financialAccountId: account.id });
    const [lineToIgnore, lineToReconcile] = lines;

    const ignored = await ignoreBankStatementLine(user.id, company.id, lineToIgnore!.id, {
      reason: "Não corresponde a nenhum movimento nosso",
    });
    expect(ignored.status).toBe("IGNORED");
    expect(ignored.ignoreReason).toBe("Não corresponde a nenhum movimento nosso");

    await reconcileBankStatementLine(user.id, company.id, lineToReconcile!.id, { settlementId: settlement.id });
    const undone = await undoReconciliation(user.id, company.id, lineToReconcile!.id);
    expect(undone.status).toBe("PENDING");
    expect(undone.reconciledSettlementId).toBeNull();

    // A baixa original continua intacta — desfazer conciliação não apaga o movimento real.
    const candidatesAgain = await listUnreconciledSettlements(user.id, company.id, account.id);
    expect(candidatesAgain.map((s) => s.id)).toEqual([settlement.id]);
  });
});

describe("isolamento entre empresas", () => {
  it("linhas e lotes de uma empresa não aparecem nem são acionáveis pela outra", async () => {
    const owner = await setupCompany("iso-owner");
    const outsider = await setupCompany("iso-outsider");

    await importBankStatement(owner.user.id, owner.company.id, {
      financialAccountId: owner.account.id,
      fileName: "extrato.csv",
      csvContent: SAMPLE_CSV,
    });

    const linesForOutsider = await listBankStatementLines(outsider.user.id, outsider.company.id, {});
    expect(linesForOutsider).toHaveLength(0);

    const batchesForOutsider = await listImportBatches(outsider.user.id, outsider.company.id);
    expect(batchesForOutsider).toHaveLength(0);
  });
});
