import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { getMonthlyCashFlowSeries } from "../reports/monthly-cash-flow-series";
import { rootClient, resetDatabase } from "./test-db";

const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

function labelFor(date: Date): string {
  return MONTH_LABEL[date.getUTCMonth()]!;
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
    openingDate: "2020-01-01",
  });
  const revenueCategory = await createCategory(user.id, company.id, {
    name: "Serviços",
    nature: "OPERATING_REVENUE",
  });
  const expenseCategory = await createCategory(user.id, company.id, {
    name: "Fornecedores",
    nature: "EXPENSE",
  });
  return { user, company, account, revenueCategory, expenseCategory };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("série mensal de fluxo de caixa (Seção 5)", () => {
  it("agrega entradas e saídas no mês certo e devolve zero para meses sem baixa", async () => {
    const { user, company, account, revenueCategory, expenseCategory } = await setupCompany("monthly");

    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10));
    const twoMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10));

    const receivable = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Serviço recente",
      categoryId: revenueCategory.id,
      originalAmountCents: 20_000,
      competenceDate: thisMonth.toISOString().slice(0, 10),
      dueDate: thisMonth.toISOString().slice(0, 10),
    });
    await registerSettlement(user.id, company.id, receivable.id, {
      financialAccountId: account.id,
      principalAmountCents: 20_000,
      effectiveDate: thisMonth.toISOString().slice(0, 10),
    });

    const payable = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Compra de dois meses atrás",
      categoryId: expenseCategory.id,
      originalAmountCents: 7_000,
      competenceDate: twoMonthsAgo.toISOString().slice(0, 10),
      dueDate: twoMonthsAgo.toISOString().slice(0, 10),
    });
    const payableSettlement = await registerSettlement(user.id, company.id, payable.id, {
      financialAccountId: account.id,
      principalAmountCents: 7_000,
      effectiveDate: twoMonthsAgo.toISOString().slice(0, 10),
    });

    // Baixa estornada num mês qualquer não deve contar.
    const reversedTitle = await createTitle(user.id, company.id, {
      type: "PAYABLE",
      description: "Baixa que será estornada",
      categoryId: expenseCategory.id,
      originalAmountCents: 9_999,
      competenceDate: thisMonth.toISOString().slice(0, 10),
      dueDate: thisMonth.toISOString().slice(0, 10),
    });
    const toReverse = await registerSettlement(user.id, company.id, reversedTitle.id, {
      financialAccountId: account.id,
      principalAmountCents: 9_999,
      effectiveDate: thisMonth.toISOString().slice(0, 10),
    });
    await reverseSettlement(user.id, company.id, toReverse.id, { reason: "teste" });

    const series = await getMonthlyCashFlowSeries(user.id, company.id, { months: 6 });

    expect(series).toHaveLength(6);
    expect(series[series.length - 1]).toEqual({
      month: labelFor(thisMonth),
      entradas: 200,
      saidas: 0,
    });
    expect(series[series.length - 3]).toEqual({
      month: labelFor(twoMonthsAgo),
      entradas: 0,
      saidas: 70,
    });
    // Mês sem nenhuma baixa (ex.: o mês anterior ao atual, sem lançamentos aqui) fica zerado.
    const emptyMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10));
    expect(series[series.length - 2]).toEqual({
      month: labelFor(emptyMonth),
      entradas: 0,
      saidas: 0,
    });

    void payableSettlement;
  });

  it("isola a série entre empresas", async () => {
    const { user, company, account, revenueCategory } = await setupCompany("iso-a");
    const other = await setupCompany("iso-b");

    const now = new Date();
    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Só da empresa A",
      categoryId: revenueCategory.id,
      originalAmountCents: 5_000,
      competenceDate: now.toISOString().slice(0, 10),
      dueDate: now.toISOString().slice(0, 10),
    });
    await registerSettlement(user.id, company.id, title.id, {
      financialAccountId: account.id,
      principalAmountCents: 5_000,
      effectiveDate: now.toISOString().slice(0, 10),
    });

    const seriesForOther = await getMonthlyCashFlowSeries(other.user.id, other.company.id, { months: 6 });
    expect(seriesForOther.every((bucket) => bucket.entradas === 0 && bucket.saidas === 0)).toBe(true);
  });

  it("respeita endMonth: a janela termina no mês pedido, não em hoje", async () => {
    const { user, company, account, revenueCategory } = await setupCompany("end-month");

    // Baixa "no futuro" em relação ao endMonth escolhido — não deve entrar.
    const now = new Date();
    const future = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Depois da janela",
      categoryId: revenueCategory.id,
      originalAmountCents: 1_000,
      competenceDate: now.toISOString().slice(0, 10),
      dueDate: now.toISOString().slice(0, 10),
    });
    await registerSettlement(user.id, company.id, future.id, {
      financialAccountId: account.id,
      principalAmountCents: 1_000,
      effectiveDate: now.toISOString().slice(0, 10),
    });

    const twoMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10));
    const endMonth = `${twoMonthsAgo.getUTCFullYear()}-${String(twoMonthsAgo.getUTCMonth() + 1).padStart(2, "0")}`;
    const inWindow = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description: "Dentro da janela",
      categoryId: revenueCategory.id,
      originalAmountCents: 3_000,
      competenceDate: twoMonthsAgo.toISOString().slice(0, 10),
      dueDate: twoMonthsAgo.toISOString().slice(0, 10),
    });
    await registerSettlement(user.id, company.id, inWindow.id, {
      financialAccountId: account.id,
      principalAmountCents: 3_000,
      effectiveDate: twoMonthsAgo.toISOString().slice(0, 10),
    });

    const series = await getMonthlyCashFlowSeries(user.id, company.id, { months: 3, endMonth });

    expect(series).toHaveLength(3);
    expect(series[series.length - 1]).toEqual({ month: labelFor(twoMonthsAgo), entradas: 30, saidas: 0 });
    expect(series.reduce((sum, bucket) => sum + bucket.entradas, 0)).toBe(30);
  });
});
