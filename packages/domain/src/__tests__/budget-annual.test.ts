import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { adjustBudgetAmount, fillBudgetYear, getAnnualBudgetReport, saveBudgetCells, setBudget } from "../budgets/budgets";
import { CategoryNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: label, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const food = await createCategory(user.id, company.id, { name: "Alimentação", nature: "EXPENSE" });
  const rent = await createCategory(user.id, company.id, { name: "Moradia", nature: "EXPENSE" });
  const income = await createCategory(user.id, company.id, { name: "Salário", nature: "OPERATING_REVENUE" });
  return { user, company, food, rent, income };
}

beforeEach(async () => resetDatabase());
afterAll(async () => rootClient.$disconnect());

const cellOf = (report: Awaited<ReturnType<typeof getAnnualBudgetReport>>, categoryId: string, month: number) =>
  report.rows.find((row) => row.categoryId === categoryId)!.cells[month - 1]!;

describe("orçamento anual", () => {
  it("mostra planejado e realizado de cada mês e o total do ano", async () => {
    const ctx = await setup("ano");
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-01", amountCents: 100_000 });
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-02", amountCents: 120_000 });
    await createTitle(ctx.user.id, ctx.company.id, { type: "PAYABLE", description: "Mercado", categoryId: ctx.food.id, originalAmountCents: 80_000, competenceDate: "2026-01-10", dueDate: "2026-01-10" });
    await createTitle(ctx.user.id, ctx.company.id, { type: "PAYABLE", description: "Mercado", categoryId: ctx.food.id, originalAmountCents: 130_000, competenceDate: "2026-02-10", dueDate: "2026-02-10" });

    const report = await getAnnualBudgetReport(ctx.user.id, ctx.company.id, 2026);
    expect(report.months).toHaveLength(12);
    expect(report.rows.map((row) => row.name)).toEqual(["Alimentação", "Moradia"]); // receita não entra
    expect(cellOf(report, ctx.food.id, 1)).toMatchObject({ plannedCents: 100_000n, actualCents: 80_000n });
    expect(cellOf(report, ctx.food.id, 2)).toMatchObject({ plannedCents: 120_000n, actualCents: 130_000n });
    const food = report.rows.find((row) => row.categoryId === ctx.food.id)!;
    expect(food).toMatchObject({ plannedCents: 220_000n, actualCents: 210_000n, status: "WARNING" });
    expect(report.monthTotals[1]).toMatchObject({ plannedCents: 120_000n, actualCents: 130_000n });
  });

  it("grava a grade de uma vez e recusa categoria de receita", async () => {
    const ctx = await setup("grade");
    await saveBudgetCells(ctx.user.id, ctx.company.id, { cells: [
      { categoryId: ctx.rent.id, period: "2026-03", amountCents: 250_000 },
      { categoryId: ctx.rent.id, period: "2026-04", amountCents: 250_000 },
    ] });
    await saveBudgetCells(ctx.user.id, ctx.company.id, { cells: [{ categoryId: ctx.rent.id, period: "2026-04", amountCents: 0 }] });
    const report = await getAnnualBudgetReport(ctx.user.id, ctx.company.id, 2026);
    expect(cellOf(report, ctx.rent.id, 3).plannedCents).toBe(250_000n);
    expect(cellOf(report, ctx.rent.id, 4).plannedCents).toBe(0n);
    await expect(saveBudgetCells(ctx.user.id, ctx.company.id, { cells: [{ categoryId: ctx.income.id, period: "2026-03", amountCents: 1 }] }))
      .rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it("planeja o ano copiando um mês, repetindo o ano anterior ou pelo gasto real, com reajuste", async () => {
    const ctx = await setup("planejar");
    expect(adjustBudgetAmount(100_000n, 1000)).toBe(110_000n);
    expect(adjustBudgetAmount(123_456n, 0)).toBe(123_456n); // sem reajuste: valor exato
    expect(adjustBudgetAmount(123_456n, 500)).toBe(129_600n); // com reajuste: arredonda para reais

    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-01", amountCents: 100_000 });
    await setBudget(ctx.user.id, ctx.company.id, { categoryId: ctx.food.id, period: "2026-05", amountCents: 50_000 });
    const copy = await fillBudgetYear(ctx.user.id, ctx.company.id, { year: 2026, mode: "COPY_MONTH", sourcePeriod: "2026-01" });
    expect(copy.written).toBe(10); // 12 meses − origem − maio (já preenchido, sem sobrescrever)
    let report = await getAnnualBudgetReport(ctx.user.id, ctx.company.id, 2026);
    expect(cellOf(report, ctx.food.id, 5).plannedCents).toBe(50_000n);
    expect(cellOf(report, ctx.food.id, 12).plannedCents).toBe(100_000n);

    // 2027 repetindo 2026 com +10%
    await fillBudgetYear(ctx.user.id, ctx.company.id, { year: 2027, mode: "PREVIOUS_YEAR", adjustmentBps: 1000 });
    report = await getAnnualBudgetReport(ctx.user.id, ctx.company.id, 2027);
    expect(cellOf(report, ctx.food.id, 1).plannedCents).toBe(110_000n);
    expect(cellOf(report, ctx.food.id, 5).plannedCents).toBe(55_000n);

    // 2027 pelo gasto real de 2026, sobrescrevendo
    await createTitle(ctx.user.id, ctx.company.id, { type: "PAYABLE", description: "Aluguel", categoryId: ctx.rent.id, originalAmountCents: 180_000, competenceDate: "2026-07-05", dueDate: "2026-07-05" });
    await fillBudgetYear(ctx.user.id, ctx.company.id, { year: 2027, mode: "PREVIOUS_YEAR_ACTUAL", adjustmentBps: 500, overwrite: true });
    report = await getAnnualBudgetReport(ctx.user.id, ctx.company.id, 2027);
    expect(cellOf(report, ctx.rent.id, 7).plannedCents).toBe(189_000n);
    expect(cellOf(report, ctx.food.id, 1).plannedCents).toBe(110_000n); // sem gasto real em jan/2026: mantém
  });
});
