import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { createTransfer } from "../transfers/create-transfer";
import { getCashFlowReport } from "../reports/cash-flow-report";
import { getOpenTitlesAgingReport } from "../reports/aging-report";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setupCompanyWithAccount(label: string) {
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
  const secondAccount = await createFinancialAccount(user.id, company.id, {
    name: "Conta secundária",
    type: "BANK",
    openingBalanceCents: 0,
    openingDate: "2026-01-01",
  });
  const revenueCategory = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  const expenseCategory = await createCategory(user.id, company.id, {
    name: "Fornecedores",
    nature: "EXPENSE",
  });
  return { user, company, account, secondAccount, revenueCategory, expenseCategory };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("fluxo de caixa realizado (Seção 13)", () => {
  it("filtra pelo período e agrupa por natureza da categoria", async () => {
    const { user, company, account, revenueCategory, expenseCategory } =
      await setupCompanyWithAccount("fluxo");

    const receivable = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço de janeiro",
      categoryId: revenueCategory.id,
      originalAmountCents: 10_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-10",
    });
    await registerSettlement(user.id, company.id, receivable.id, {
      financialAccountId: account.id,
      principalAmountCents: 10_000,
      effectiveDate: "2026-01-05", // dentro do período
    });

    const payable = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Compra de fevereiro",
      categoryId: expenseCategory.id,
      originalAmountCents: 4_000,
      competenceDate: "2026-02-01",
      dueDate: "2026-02-10",
    });
    await registerSettlement(user.id, company.id, payable.id, {
      financialAccountId: account.id,
      principalAmountCents: 4_000,
      effectiveDate: "2026-02-05", // fora do período de janeiro
    });

    const report = await getCashFlowReport(user.id, company.id, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.titleDescription).toBe("Serviço de janeiro");
    expect(report.totalCents).toBe(10_000n);
    expect(report.subtotalsByNature).toEqual([{ nature: "OPERATING_REVENUE", cents: 10_000n }]);
  });

  it("não inclui transferências entre contas próprias (Seção 8)", async () => {
    const { user, company, account, secondAccount } = await setupCompanyWithAccount("fluxo-transf");

    await createFinancialAccount(user.id, company.id, {
      name: "extra",
      type: "BANK",
      openingBalanceCents: 100_000,
      openingDate: "2026-01-01",
    });
    await createTransfer(user.id, company.id, {
      fromAccountId: account.id,
      toAccountId: secondAccount.id,
      amountCents: 5_000,
      transferDate: "2026-01-15",
    });

    const report = await getCashFlowReport(user.id, company.id, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(report.entries).toHaveLength(0);
    expect(report.totalCents).toBe(0n);
  });
});

describe("contas em aberto por faixa de atraso (Seção 30)", () => {
  it("classifica um título vencido há 10 dias na faixa 8-15 e ignora quitados", async () => {
    const { user, company, account, revenueCategory } = await setupCompanyWithAccount("aging");

    const overdue = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Vencido há 10 dias",
      categoryId: revenueCategory.id,
      originalAmountCents: 5_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-10",
    });

    const settled = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Já quitado",
      categoryId: revenueCategory.id,
      originalAmountCents: 3_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-05",
    });
    await registerSettlement(user.id, company.id, settled.id, {
      financialAccountId: account.id,
      principalAmountCents: 3_000,
      effectiveDate: "2026-01-05",
    });

    const report = await getOpenTitlesAgingReport(user.id, company.id, {
      asOfDate: "2026-01-20", // 10 dias depois do vencimento de "overdue"
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.titleId).toBe(overdue.id);
    expect(report.entries[0]?.bucket).toBe("D8_15");
    const bucket = report.totalsByBucket.find((b) => b.bucket === "D8_15");
    expect(bucket?.cents).toBe(5_000n);
  });

  it("isolamento: não mostra título de outra empresa", async () => {
    const owner = await setupCompanyWithAccount("aging-owner");
    const outsider = await setupCompanyWithAccount("aging-outsider");

    await createTitle(owner.user.id, owner.company.id, {
      type: "PAYABLE",
      description: "Título do owner",
      categoryId: owner.expenseCategory.id,
      originalAmountCents: 1_000,
      competenceDate: "2026-01-01",
      dueDate: "2026-01-10",
    });

    const report = await getOpenTitlesAgingReport(outsider.user.id, outsider.company.id, {});
    expect(report.entries).toHaveLength(0);
  });
});
