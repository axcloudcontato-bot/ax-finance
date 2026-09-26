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
