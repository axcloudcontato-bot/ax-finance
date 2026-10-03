import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { resetCompanyLedger } from "../companies/reset-company-ledger";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { createBalanceAdjustment } from "../financial-accounts/create-balance-adjustment";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { listTitles } from "../titles/list-titles";
import { deleteTitle } from "../titles/delete-title";
import { createTitleAttachment } from "../attachments/attachments";
import { registerSettlement } from "../titles/register-settlement";
import { createTransfer } from "../transfers/create-transfer";
import { createRecurrenceRule } from "../recurrences/create-recurrence-rule";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";
import { closePeriod } from "../closures/close-period";
import { listPeriodClosures } from "../closures/list-period-closures";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { listBankStatementLines } from "../reconciliation/list-bank-statement-lines";
import { reconcileBankStatementLine } from "../reconciliation/reconcile-bank-statement-line";
import { listAuditEvents } from "../audit/list-audit-events";
import { CompanyPermissionDeniedError, CompanyResetConfirmationError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setup(label: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Dona ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const accountA = await createFinancialAccount(user.id, company.id, {
    name: "Conta A",
    type: "BANK",
    openingBalanceCents: 100_000,
    openingDate: "2026-01-01",
  });
  const accountB = await createFinancialAccount(user.id, company.id, {
    name: "Conta B",
    type: "CASH",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
  return { user, company, accountA, accountB, revenue };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("reset da conta (zerar lançamentos)", () => {
  it("apaga de verdade títulos, baixas, transferências, ajustes, recorrências, anexos, extratos e fechamentos, e mantém contas e cadastros", async () => {
    const { user, company, accountA, accountB, revenue } = await setup("reset");
    const today = new Date().toISOString().slice(0, 10);

    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço prestado",
      categoryId: revenue.id,
      originalAmountCents: 50_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    const settlement = await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: accountA.id,
      principalAmountCents: 50_000,
      effectiveDate: "2026-09-10",
    });
    await createTransfer(user.id, company.id, {
      fromAccountId: accountA.id,
      toAccountId: accountB.id,
      amountCents: 20_000,
      transferDate: "2026-09-11",
    });
    await createBalanceAdjustment(user.id, company.id, {
      financialAccountId: accountA.id,
      targetBalanceCents: 120_000,
      reason: "Divergência",
      effectiveDate: "2026-09-12",
    });
    await createRecurrenceRule(user.id, company.id, {
      type: "PAYABLE",
      description: "Aluguel",
      categoryId: revenue.id,
      amountCents: 150_000,
      dayOfMonth: Number(today.slice(8, 10)),
      startDate: today,
    });
    await generateDueOccurrences(user.id, company.id);
    await closePeriod(user.id, company.id, { period: "2026-08" });

    // Título já removido das telas (soft delete) também precisa sumir do banco.
    const removed = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Já excluído",
      categoryId: revenue.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-09-01",
      dueDate: "2026-09-01",
    });
    await deleteTitle(user.id, company.id, removed.id, { reason: "teste" });

    const attachmentId = randomUUID();
    await createTitleAttachment(user.id, company.id, title.id, {
      id: attachmentId,
      originalName: "nota.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      sha256: "a".repeat(64),
      storageKey: `${company.id}/${title.id}/${attachmentId}`,
    });

    await importBankStatement(user.id, company.id, {
      financialAccountId: accountA.id,
      fileName: "extrato.csv",
      csvContent: ["data,descricao,valor", "10/09/2026,Recebimento,500,00"].join("\n"),
    });
    const [line] = await listBankStatementLines(user.id, company.id, { financialAccountId: accountA.id });
    await reconcileBankStatementLine(user.id, company.id, line!.id, { settlementId: settlement.id });

    expect((await listTitles(user.id, company.id)).length).toBeGreaterThan(1);

    const summary = await resetCompanyLedger(user.id, company.id, { confirmation: company.name });
    expect(summary).toMatchObject({
      settlements: 1,
      transfers: 1,
      balanceAdjustments: 1,
      statementLines: 1,
      importBatches: 1,
      recurrenceRules: 1,
      periodClosures: 1,
    });
    expect(summary.titles).toBeGreaterThan(2); // título, ocorrências da recorrência e o já excluído
    expect(summary.files.attachments).toEqual([
      { storageKey: `${company.id}/${title.id}/${attachmentId}`, storageBackend: "LOCAL" },
    ]);

    // Nada de lançamento sobrou no banco, nem o que estava só marcado como excluído.
    const where = { companyId: company.id };
    expect(await rootClient.title.count({ where })).toBe(0);
    expect(await rootClient.settlement.count({ where })).toBe(0);
    expect(await rootClient.transfer.count({ where })).toBe(0);
    expect(await rootClient.balanceAdjustment.count({ where })).toBe(0);
    expect(await rootClient.recurrenceRule.count({ where })).toBe(0);
    expect(await rootClient.bankStatementLine.count({ where })).toBe(0);
    expect(await rootClient.importBatch.count({ where })).toBe(0);
    expect(await rootClient.periodClosure.count({ where })).toBe(0);
    expect(await rootClient.attachment.count({ where })).toBe(0);
    expect(await rootClient.idempotencyRecord.count({ where })).toBe(0);

    // Saldos voltam ao de abertura e a rotina recorrente não tem o que gerar.
    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(accounts.find((a) => a.id === accountA.id)!.currentBalanceCents).toBe(100_000n);
    expect(accounts.find((a) => a.id === accountB.id)!.currentBalanceCents).toBe(0n);
    expect(await listTitles(user.id, company.id)).toHaveLength(0);
    expect((await generateDueOccurrences(user.id, company.id)).createdCount).toBe(0);
    expect(await listPeriodClosures(user.id, company.id)).toHaveLength(0);
    expect(await listBankStatementLines(user.id, company.id, { financialAccountId: accountA.id })).toHaveLength(0);

    // Contas e cadastros ficam; a auditoria registra o reset.
    expect(await rootClient.financialAccount.count({ where })).toBe(2);
    expect(await rootClient.category.count({ where: { companyId: company.id, id: revenue.id } })).toBe(1);
    const events = await listAuditEvents(user.id, company.id, {});
    expect(events.some((event) => event.eventType === "COMPANY_LEDGER_RESET")).toBe(true);

    // Dá para começar de novo na mesma empresa.
    const again = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Depois do reset",
      categoryId: revenue.id,
      originalAmountCents: 5_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });
    expect(again.id).toBeTruthy();
  });

  it("exige o nome exato da empresa e não altera nada quando a confirmação falha", async () => {
    const { user, company, revenue } = await setup("confirmacao");
    await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço",
      categoryId: revenue.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-09-10",
      dueDate: "2026-09-10",
    });

    await expect(resetCompanyLedger(user.id, company.id, { confirmation: "empresa errada" })).rejects.toBeInstanceOf(
      CompanyResetConfirmationError
    );
    expect(await listTitles(user.id, company.id)).toHaveLength(1);
  });

  it("só o proprietário pode zerar", async () => {
    const { company } = await setup("permissao");
    const admin = await registerUser({ email: uniqueEmail("admin"), name: "Admin", password: "senha-forte-123" });
    await rootClient.membership.create({
      data: { userId: admin.id, companyId: company.id, role: "FINANCE_ADMIN", status: "ACTIVE" },
    });

    await expect(resetCompanyLedger(admin.id, company.id, { confirmation: company.name })).rejects.toBeInstanceOf(
      CompanyPermissionDeniedError
    );
  });
});
