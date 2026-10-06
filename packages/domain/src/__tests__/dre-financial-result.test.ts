import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setup(label: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
  const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
  const expense = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  return { user, company, account, revenue, expense };
}

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("DRE: resultado financeiro e fora do resultado", () => {
  it("juros, multa, tarifa e desconto pagos e recebidos entram no resultado financeiro, pela data da baixa", async () => {
    const { user, company, account, revenue, expense } = await setup("financeiro");
    const bill = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: expense.id, originalAmountCents: 100_000, competenceDate: "2026-09-05", dueDate: "2026-09-10" });
    await registerSettlement(user.id, company.id, bill.id, { financialAccountId: account.id, principalAmountCents: 95_000, discountCents: 5_000, interestPenaltyCents: 2_500, feesCents: 300, effectiveDate: "2026-09-20" });
    const invoice = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Serviço", categoryId: revenue.id, originalAmountCents: 50_000, competenceDate: "2026-09-02", dueDate: "2026-09-12" });
    await registerSettlement(user.id, company.id, invoice.id, { financialAccountId: account.id, principalAmountCents: 49_000, discountCents: 1_000, interestPenaltyCents: 400, feesCents: 900, effectiveDate: "2026-09-15" });

    const report = await getManagerialIncomeStatement(user.id, company.id, SEPTEMBER);

    // Operacional continua pelo valor ORIGINAL dos títulos.
    expect(report.operatingResultCents).toBe(BigInt(50_000 - 100_000));
    const financial = Object.fromEntries(report.financialLines.map((line) => [line.label, Number(line.cents)]));
    expect(financial).toEqual({
      "Juros e multas pagos": -2_500,
      "Tarifas pagas": -300,
      "Descontos obtidos": 5_000,
      "Juros e multas recebidos": 400,
      "Taxas retidas (maquininha, gateway)": -900,
      "Descontos concedidos": -1_000,
    });
    expect(report.financialResultCents).toBe(BigInt(-2_500 - 300 + 5_000 + 400 - 900 - 1_000));
    expect(report.totalCents).toBe(report.operatingResultCents + report.financialResultCents);
  });

  it("baixa estornada e baixa fora do período não entram", async () => {
    const { user, company, account, expense } = await setup("estorno");
    const bill = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: expense.id, originalAmountCents: 10_000, competenceDate: "2026-09-05", dueDate: "2026-09-10" });
    const reversed = await registerSettlement(user.id, company.id, bill.id, { financialAccountId: account.id, principalAmountCents: 5_000, interestPenaltyCents: 700, effectiveDate: "2026-09-12" });
    await reverseSettlement(user.id, company.id, reversed.id, { reason: "engano" });
    await registerSettlement(user.id, company.id, bill.id, { financialAccountId: account.id, principalAmountCents: 5_000, interestPenaltyCents: 900, effectiveDate: "2026-10-12" });

    const report = await getManagerialIncomeStatement(user.id, company.id, SEPTEMBER);
    expect(report.financialLines).toEqual([]);
    expect(report.financialResultCents).toBe(BigInt(0));
  });

  it("investimento, financiamento e patrimônio ficam fora do resultado e só aparecem para conferência", async () => {
    const { user, company, revenue, expense } = await setup("capital");
    const loan = await createCategory(user.id, company.id, { name: "Empréstimo", nature: "FINANCING" });
    const equipment = await createCategory(user.id, company.id, { name: "Máquina", nature: "INVESTMENT" });
    const owner = await createCategory(user.id, company.id, { name: "Retirada de sócio", nature: "EQUITY" });
    const base = { competenceDate: "2026-09-05", dueDate: "2026-09-10" };

    await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Serviço", categoryId: revenue.id, originalAmountCents: 80_000, ...base });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Aluguel", categoryId: expense.id, originalAmountCents: 20_000, ...base });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Parcela do empréstimo", categoryId: loan.id, originalAmountCents: 30_000, ...base });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Compra de máquina", categoryId: equipment.id, originalAmountCents: 40_000, ...base });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Retirada", categoryId: owner.id, originalAmountCents: 10_000, ...base });

    const report = await getManagerialIncomeStatement(user.id, company.id, SEPTEMBER);

    expect(report.totalCents).toBe(BigInt(60_000));
    expect(report.operatingResultCents).toBe(BigInt(60_000));
    expect(report.outsideResult.map((line) => Number(line.cents)).sort((a, b) => a - b)).toEqual([-40_000, -30_000, -10_000]);
  });
});
