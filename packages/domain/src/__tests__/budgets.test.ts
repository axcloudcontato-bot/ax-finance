import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createTitle } from "../titles/create-title";
import { cancelTitle } from "../titles/cancel-title";
import { replaceTitleAllocations } from "../titles/title-allocations";
import { budgetStatus, copyBudgets, getBudgetReport, setBudget } from "../budgets/budgets";
import { createCreditCard, createCreditCardPurchase } from "../credit-cards";
import { listAuditEvents } from "../audit/list-audit-events";
import { CategoryNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

async function setup(label: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  await createFinancialAccount(user.id, company.id, { name: "Conta", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
  const food = await createCategory(user.id, company.id, { name: "Alimentação", nature: "EXPENSE" });
  const rent = await createCategory(user.id, company.id, { name: "Moradia", nature: "EXPENSE" });
  const income = await createCategory(user.id, company.id, { name: "Salário", nature: "OPERATING_REVENUE" });
  return { user, company, food, rent, income };
}

const spend = (ctx: Awaited<ReturnType<typeof setup>>, categoryId: string, cents: number, competenceDate: string, description = "Gasto") =>
  createTitle(ctx.user.id, ctx.company.id, { type: "PAYABLE", description, categoryId, originalAmountCents: cents, competenceDate, dueDate: competenceDate });

const rowOf = async (ctx: Awaited<ReturnType<typeof setup>>, period: string, categoryId: string) =>
  (await getBudgetReport(ctx.user.id, ctx.company.id, period)).rows.find((row) => row.categoryId === categoryId)!;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("orçamento por categoria e mês", () => {
  it("define, altera e remove (com 0) o orçamento, e registra a mudança na auditoria", async () => {
    const ctx = await setup("definir");
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: 80_000 });
    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).plannedCents)).toBe(80_000);

    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: 90_000 });
    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).plannedCents)).toBe(90_000);
    expect(await rootClient.budget.count({ where: { companyId: ctx.company.id } })).toBe(1);

    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: 0 });
    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).plannedCents)).toBe(0);

    const events = (await listAuditEvents(ctx.user.id, ctx.company.id, {})).filter((event) => event.eventType === "BUDGET_SET");
    expect(events).toHaveLength(3);
  });

  it("recusa categoria de receita, período inválido e valor negativo", async () => {
    const ctx = await setup("invalidos");
    await expect(setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.income.id, period: "2026-10", amountCents: 1_000 })).rejects.toBeInstanceOf(CategoryNotFoundError);
    await expect(setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-13", amountCents: 1_000 })).rejects.toThrow();
    await expect(setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: -1 })).rejects.toThrow();
    const report = await getBudgetReport(ctx.user.id, ctx.company.id, "2026-10");
    expect(report.rows.map((row) => row.name).sort()).toEqual(["Alimentação", "Moradia"]);
  });

  it("o realizado segue a competência: títulos do mês, rateio, sem cancelados nem outros meses", async () => {
    const ctx = await setup("realizado");
    await spend(ctx, ctx.food.id, 30_000, "2026-10-05");
    await spend(ctx, ctx.food.id, 10_000, "2026-10-28");
    await spend(ctx, ctx.food.id, 99_000, "2026-09-30");
    const cancelled = await spend(ctx, ctx.food.id, 55_000, "2026-10-10");
    await cancelTitle(ctx.user.id, ctx.company.id, cancelled.id, { reason: "teste" });
    const split = await spend(ctx, ctx.food.id, 20_000, "2026-10-12", "Mercado e aluguel");
    await replaceTitleAllocations(ctx.user.id, ctx.company.id, split.id, { allocations: [
      { categoryId: ctx.food.id, amountCents: 5_000 },
      { categoryId: ctx.rent.id, amountCents: 15_000 },
    ] });

    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).actualCents)).toBe(30_000 + 10_000 + 5_000);
    expect(Number((await rowOf(ctx, "2026-10", ctx.rent.id)).actualCents)).toBe(15_000);
    expect(Number((await rowOf(ctx, "2026-09", ctx.food.id)).actualCents)).toBe(99_000);
  });

  it("compras no cartão contam pela categoria e a fatura não conta de novo", async () => {
    const ctx = await setup("cartao");
    const card = await createCreditCard(ctx.user.id, ctx.company.id, { name: "Cartão", limitCents: 1_000_000, closingDay: 10, dueDay: 20 });
    await createCreditCardPurchase(ctx.user.id, ctx.company.id, { cardId: card.id, description: "Supermercado", categoryId: ctx.food.id, totalAmountCents: 40_000, purchaseDate: "2026-10-03" });
    // 3x: só a parcela de outubro pesa em outubro.
    await createCreditCardPurchase(ctx.user.id, ctx.company.id, { cardId: card.id, description: "Geladeira", categoryId: ctx.rent.id, totalAmountCents: 30_000, purchaseDate: "2026-10-04", installmentCount: 3 });

    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).actualCents)).toBe(40_000);
    expect(Number((await rowOf(ctx, "2026-10", ctx.rent.id)).actualCents)).toBe(10_000);
    expect(Number((await rowOf(ctx, "2026-11", ctx.rent.id)).actualCents)).toBe(10_000);
    const invoiceCategory = (await getBudgetReport(ctx.user.id, ctx.company.id, "2026-10")).rows.find((row) => row.name === "Fatura de cartão de crédito");
    expect(Number(invoiceCategory?.actualCents ?? 0)).toBe(0);
  });

  it("status: dentro, atenção a partir de 80%, estourou e gasto sem orçamento", async () => {
    expect(budgetStatus(BigInt(1_000), BigInt(500))).toBe("OK");
    expect(budgetStatus(BigInt(1_000), BigInt(800))).toBe("WARNING");
    expect(budgetStatus(BigInt(1_000), BigInt(1_000))).toBe("WARNING");
    expect(budgetStatus(BigInt(1_000), BigInt(1_001))).toBe("OVER");
    expect(budgetStatus(BigInt(0), BigInt(10))).toBe("UNBUDGETED");
    expect(budgetStatus(BigInt(0), BigInt(0))).toBe("OK");

    const ctx = await setup("status");
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: 50_000 });
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.rent.id, period: "2026-10", amountCents: 100_000 });
    await spend(ctx, ctx.food.id, 60_000, "2026-10-05");
    await spend(ctx, ctx.rent.id, 85_000, "2026-10-06");
    const report = await getBudgetReport(ctx.user.id, ctx.company.id, "2026-10");
    expect(report.rows.find((row) => row.categoryId === ctx.food.id)).toMatchObject({ status: "OVER", percent: 120 });
    expect(report.rows.find((row) => row.categoryId === ctx.rent.id)).toMatchObject({ status: "WARNING", percent: 85 });
    expect(report.totals).toMatchObject({ overCount: 1, warningCount: 1 });
    expect(Number(report.totals.plannedCents)).toBe(150_000);
    expect(Number(report.totals.actualOnBudgetedCents)).toBe(145_000);
  });

  it("copiar do mês anterior só preenche o que ainda não tem valor no destino", async () => {
    const ctx = await setup("copiar");
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-09", amountCents: 70_000 });
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.rent.id, period: "2026-09", amountCents: 120_000 });
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-10", amountCents: 75_000 });

    expect(await copyBudgets(ctx.user.id, ctx.company.id, { fromPeriod: "2026-09", toPeriod: "2026-10" })).toEqual({ copied: 1 });
    expect(Number((await rowOf(ctx, "2026-10", ctx.food.id)).plannedCents)).toBe(75_000);
    expect(Number((await rowOf(ctx, "2026-10", ctx.rent.id)).plannedCents)).toBe(120_000);
    expect(await copyBudgets(ctx.user.id, ctx.company.id, { fromPeriod: "2026-09", toPeriod: "2026-10" })).toEqual({ copied: 0 });
  });

  it("empresas diferentes não enxergam o orçamento uma da outra", async () => {
    const a = await setup("iso-a");
    const b = await setup("iso-b");
    await setBudget(a.user.id, a.company.id, { categoryId: a.food.id, period: "2026-10", amountCents: 10_000 });
    const report = await getBudgetReport(b.user.id, b.company.id, "2026-10");
    expect(report.totals.plannedCents).toBe(BigInt(0));
    await expect(setBudget(b.user.id, b.company.id, { categoryId: a.food.id, period: "2026-10", amountCents: 5_000 })).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
