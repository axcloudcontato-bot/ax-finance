import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createParty } from "../parties/create-party";
import { createCostCenter } from "../cost-centers/cost-centers";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { importBankStatement } from "../reconciliation/import-bank-statement";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("visão analítica do dashboard", () => {
  it("concilia realizado, operacional, previsão, ranking, alertas e filtros", async () => {
    const user = await registerUser({ email: uniqueEmail("dashboard"), name: "Gestora", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa Dashboard" });
    const account = await createFinancialAccount(user.id, company.id, {
      name: "Banco principal", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01",
    });
    const otherAccount = await createFinancialAccount(user.id, company.id, {
      name: "Caixa", type: "CASH", openingBalanceCents: 5_000, openingDate: "2026-01-01",
    });
    const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
    const expense = await createCategory(user.id, company.id, { name: "Estrutura", nature: "EXPENSE" });
    const financing = await createCategory(user.id, company.id, { name: "Empréstimos", nature: "FINANCING" });
    const party = await createParty(user.id, company.id, { name: "Cliente e fornecedor", isClient: true, isSupplier: true });
    const costCenter = await createCostCenter(user.id, company.id, { name: "Operação" });

    const receivable = await createTitle(user.id, company.id, {
      type: "RECEIVABLE", description: "Contrato mensal", categoryId: revenue.id, partyId: party.id,
      costCenterId: costCenter.id, originalAmountCents: 50_000, competenceDate: "2026-09-01", dueDate: "2026-10-10",
    });
    await registerSettlement(user.id, company.id, receivable.id, {
      financialAccountId: account.id, principalAmountCents: 40_000, effectiveDate: "2026-09-10",
    });

    const payable = await createTitle(user.id, company.id, {
      type: "PAYABLE", description: "Aluguel", categoryId: expense.id, partyId: party.id,
      costCenterId: costCenter.id, originalAmountCents: 20_000, competenceDate: "2026-09-01", dueDate: "2026-10-05",
    });
    await registerSettlement(user.id, company.id, payable.id, {
      financialAccountId: account.id, principalAmountCents: 12_000, effectiveDate: "2026-09-12",
    });

    const loan = await createTitle(user.id, company.id, {
      type: "RECEIVABLE", description: "Crédito contratado", categoryId: financing.id,
      costCenterId: costCenter.id, originalAmountCents: 30_000, competenceDate: "2026-09-01", dueDate: "2026-09-15",
    });
    await registerSettlement(user.id, company.id, loan.id, {
      financialAccountId: account.id, principalAmountCents: 30_000, effectiveDate: "2026-09-15",
    });

    await createTitle(user.id, company.id, {
      type: "PAYABLE", description: "Conta vencida", categoryId: expense.id, partyId: party.id, costCenterId: costCenter.id,
      originalAmountCents: 9_000, competenceDate: "2026-09-01", dueDate: "2026-09-05",
    });
    await importBankStatement(user.id, company.id, {
      financialAccountId: account.id,
      fileName: "setembro.csv",
      csvContent: "data,descricao,valor\n2026-09-20,Movimento pendente,123.45",
    });

    const overview = await getDashboardOverview(user.id, company.id, {
      from: "2026-09-01", to: "2026-09-30", today: "2026-09-27",
      comparisonFrom: "2026-08-01", comparisonTo: "2026-08-31",
      financialAccountId: account.id, partyId: party.id, costCenterId: costCenter.id,
    });

    expect(overview.current.receivedCents).toBe(BigInt(40_000));
    expect(overview.current.paidCents).toBe(BigInt(12_000));
    expect(overview.current.operatingNetCents).toBe(BigInt(28_000));
    expect(overview.comparison?.receivedCents).toBe(BigInt(0));
    expect(overview.availableBalanceCents).toBe(BigInt(158_000));
    expect(overview.projectedBalanceCents).toBe(BigInt(151_000));
    expect(overview.balanceWithoutOverdueReceivablesCents).toBe(BigInt(151_000));
    expect(overview.projectionTitles.map((title) => title.description)).toEqual(["Conta vencida", "Aluguel", "Contrato mensal"]);
    expect(overview.overdueTitles).toHaveLength(1);
    expect(overview.reconciliation.pendingCount).toBe(1);
    expect(overview.reconciliation.pendingAmountCents).toBe(BigInt(12_345));
    expect(overview.categoryRanking.map((item) => [item.categoryName, item.cents])).toEqual([
      ["Serviços", BigInt(40_000)],
      ["Estrutura", BigInt(-12_000)],
    ]);
    expect(overview.flowSeries).toHaveLength(30);
    expect(overview.accounts.map((item) => item.id)).toEqual([account.id]);

    const otherAccountOnly = await getDashboardOverview(user.id, company.id, {
      from: "2026-09-01", to: "2026-09-30", today: "2026-09-27", financialAccountId: otherAccount.id,
    });
    expect(otherAccountOnly.current.receivedCents).toBe(BigInt(0));
    expect(otherAccountOnly.availableBalanceCents).toBe(BigInt(5_000));
    expect(otherAccountOnly.reconciliation.pendingCount).toBe(0);
  });

  it("aponta a primeira data em que a projeção cruza zero", async () => {
    const user = await registerUser({ email: uniqueEmail("risk"), name: "Gestora", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa Risco" });
    const account = await createFinancialAccount(user.id, company.id, {
      name: "Banco", type: "BANK", openingBalanceCents: 10_000, openingDate: "2026-01-01",
    });
    const expense = await createCategory(user.id, company.id, { name: "Impostos", nature: "EXPENSE" });
    const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
    await createTitle(user.id, company.id, {
      type: "PAYABLE", description: "Imposto", categoryId: expense.id, originalAmountCents: 15_000,
      competenceDate: "2026-09-01", dueDate: "2026-10-02",
    });
    const futureReceipt = await createTitle(user.id, company.id, {
      type: "RECEIVABLE", description: "Recebimento futuro", categoryId: revenue.id, originalAmountCents: 20_000,
      competenceDate: "2026-09-01", dueDate: "2026-10-03",
    });
    await registerSettlement(user.id, company.id, futureReceipt.id, {
      financialAccountId: account.id, principalAmountCents: 20_000, effectiveDate: "2026-10-03",
    });

    const overview = await getDashboardOverview(user.id, company.id, {
      from: "2026-09-01", to: "2026-09-30", today: "2026-09-27",
    });
    expect(overview.availableBalanceCents).toBe(BigInt(10_000));
    expect(overview.current.receivedCents).toBe(BigInt(0));
    expect(overview.projectionTitles.map((title) => title.description)).toEqual(["Imposto", "Recebimento futuro"]);
    expect(overview.projectedBalanceCents).toBe(BigInt(15_000));
    expect(overview.firstNegativeDate).toBe("2026-10-02");
  });

  it("expõe o risco de caixa quando recebíveis vencidos não entram hoje", async () => {
    const user = await registerUser({ email: uniqueEmail("overdue-forecast"), name: "Gestora", password: "senha-forte-123" });
    const company = await createCompany(user.id, { name: "Empresa Cenários" });
    await createFinancialAccount(user.id, company.id, {
      name: "Banco", type: "BANK", openingBalanceCents: 10_000, openingDate: "2026-01-01",
    });
    const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
    const expense = await createCategory(user.id, company.id, { name: "Despesas", nature: "EXPENSE" });
    await createTitle(user.id, company.id, {
      type: "RECEIVABLE", description: "Cliente atrasado", categoryId: revenue.id,
      originalAmountCents: 20_000, competenceDate: "2026-09-01", dueDate: "2026-09-20",
    });
    await createTitle(user.id, company.id, {
      type: "PAYABLE", description: "Fornecedor atrasado", categoryId: expense.id,
      originalAmountCents: 15_000, competenceDate: "2026-09-01", dueDate: "2026-09-25",
    });

    const overview = await getDashboardOverview(user.id, company.id, {
      from: "2026-10-01", to: "2026-10-31", today: "2026-10-04",
    });

    expect(overview.projectedBalanceCents).toBe(BigInt(15_000));
    expect(overview.balanceWithoutOverdueReceivablesCents).toBe(BigInt(-5_000));
    expect(overview.firstNegativeDate).toBeNull();
    expect(overview.firstNegativeWithoutOverdueDate).toBe("2026-10-04");
    expect(overview.cashProjectionSeries[0]).toMatchObject({
      date: "2026-10-04",
      projectedBalanceCents: BigInt(15_000),
      withoutOverdueReceivablesCents: BigInt(-5_000),
    });
    expect(overview.cashProjectionSeries).toHaveLength(31);
  });
});
