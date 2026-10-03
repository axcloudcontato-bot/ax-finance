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
  it("zera títulos, baixas, transferências, ajustes, recorrências e fechamentos sem apagar nada, e mantém o saldo de abertura", async () => {
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
      statementLinesUnreconciled: 1,
      periodsReopened: 1,
    });
    expect(summary.titles).toBeGreaterThan(1);
    expect(summary.recurrenceRulesCancelled).toBe(1);

    // Saldos voltam ao de abertura.
    const accounts = await listFinancialAccountsWithBalance(user.id, company.id);
    expect(accounts.find((a) => a.id === accountA.id)!.currentBalanceCents).toBe(100_000n);
    expect(accounts.find((a) => a.id === accountB.id)!.currentBalanceCents).toBe(0n);

    // Nada de títulos nas telas; a rotina recorrente não gera mais nada.
    expect(await listTitles(user.id, company.id)).toHaveLength(0);
    expect((await generateDueOccurrences(user.id, company.id)).createdCount).toBe(0);

    // Linha de extrato volta a pendente; período reaberto.
    const lines = await listBankStatementLines(user.id, company.id, { financialAccountId: accountA.id });
    expect(lines[0]).toMatchObject({ status: "PENDING", reconciledSettlementId: null });
    const closures = await listPeriodClosures(user.id, company.id);
    expect(closures.every((closure) => closure.status !== "CLOSED")).toBe(true);

    // Nada foi apagado fisicamente: títulos e baixas continuam no banco, com motivo.
    expect(await rootClient.title.count({ where: { companyId: company.id } })).toBe(summary.titles);
    const archivedSettlement = await rootClient.settlement.findUniqueOrThrow({ where: { id: settlement.id } });
    expect(archivedSettlement.reversedAt).not.toBeNull();
    expect(archivedSettlement.reversalReason).toBeTruthy();

    // Cadastros ficam; auditoria registra o reset.
    expect(await rootClient.category.count({ where: { companyId: company.id, id: revenue.id } })).toBe(1);
    const events = await listAuditEvents(user.id, company.id, {});
    expect(events.some((event) => event.eventType === "COMPANY_LEDGER_RESET")).toBe(true);
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
