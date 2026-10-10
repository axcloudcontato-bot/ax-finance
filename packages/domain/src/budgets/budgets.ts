import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CategoryNotFoundError } from "../errors";

const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Gasto planejado só faz sentido em categoria que não seja de receita. */
const SPENDING_NATURES = ["COST", "EXPENSE", "INVESTMENT", "FINANCING", "EQUITY"] as const;

export const setBudgetInput = z.object({
  categoryId: z.string().uuid(),
  period,
  /** Centavos inteiros; 0 remove o orçamento daquela categoria no mês. */
  amountCents: z.number().int().min(0),
});

/**
 * Define (ou remove, com 0) o orçamento de uma categoria num mês. É um parâmetro declarado pelo
 * usuário: serve para comparar com o realizado e avisar, nunca para bloquear pagamento.
 */
export async function setBudget(userId: string, companyId: string, input: unknown) {
  const data = setBudgetInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE", nature: { in: [...SPENDING_NATURES] } } });
    if (!category) throw new CategoryNotFoundError();

    const key = { companyId_categoryId_period: { companyId, categoryId: data.categoryId, period: data.period } };
    const existing = await tx.budget.findUnique({ where: key });
    if (data.amountCents === 0) {
      if (existing) await tx.budget.delete({ where: key });
    } else {
      await tx.budget.upsert({
        where: key,
        create: { companyId, categoryId: data.categoryId, period: data.period, amountCents: BigInt(data.amountCents), createdByUserId: userId },
        update: { amountCents: BigInt(data.amountCents) },
      });
    }
    const previous = existing?.amountCents ?? BigInt(0);
    if (previous !== BigInt(data.amountCents)) {
      await recordAuditEvent(tx, {
        companyId, actorUserId: userId, eventType: "BUDGET_SET", resourceType: "Category", resourceId: data.categoryId,
        summary: `${category.name} · ${data.period}`,
        metadata: { period: data.period, previousAmountCents: previous.toString(), amountCents: data.amountCents },
      });
    }
    return { categoryId: data.categoryId, period: data.period, amountCents: BigInt(data.amountCents) };
  });
}

export const copyBudgetsInput = z.object({ fromPeriod: period, toPeriod: period });

/** Copia os orçamentos de um mês para outro, só nas categorias que ainda não têm valor no destino. */
export async function copyBudgets(userId: string, companyId: string, input: unknown) {
  const data = copyBudgetsInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const [source, target] = await Promise.all([
      tx.budget.findMany({ where: { companyId, period: data.fromPeriod, category: { status: "ACTIVE" } } }),
      tx.budget.findMany({ where: { companyId, period: data.toPeriod }, select: { categoryId: true } }),
    ]);
    const already = new Set(target.map((row) => row.categoryId));
    const toCreate = source.filter((row) => !already.has(row.categoryId));
    if (toCreate.length > 0) {
      await tx.budget.createMany({
        data: toCreate.map((row) => ({ companyId, categoryId: row.categoryId, period: data.toPeriod, amountCents: row.amountCents, createdByUserId: userId })),
      });
      await recordAuditEvent(tx, {
        companyId, actorUserId: userId, eventType: "BUDGET_COPIED", resourceType: "Company", resourceId: companyId,
        summary: `${data.fromPeriod} → ${data.toPeriod}`, metadata: { copied: toCreate.length },
      });
    }
    return { copied: toCreate.length };
  });
}

export type BudgetStatus = "OK" | "WARNING" | "OVER" | "UNBUDGETED";

export interface BudgetRow {
  categoryId: string;
  name: string;
  parentId: string | null;
  plannedCents: bigint;
  actualCents: bigint;
  /** Planejado − realizado; negativo = estourou. */
  remainingCents: bigint;
  /** Realizado / planejado, em %. Sem planejado, 0. */
  percent: number;
  status: BudgetStatus;
}

/** Acima de 80% do orçamento já pede atenção; acima de 100%, estourou. */
export const BUDGET_WARNING_PERCENT = 80;

export function budgetStatus(plannedCents: bigint, actualCents: bigint): BudgetStatus {
  if (plannedCents === BigInt(0)) return actualCents > BigInt(0) ? "UNBUDGETED" : "OK";
  if (actualCents > plannedCents) return "OVER";
  return actualCents * BigInt(100) >= plannedCents * BigInt(BUDGET_WARNING_PERCENT) ? "WARNING" : "OK";
}

/**
 * Orçado × realizado de um mês, por categoria de gasto. O realizado segue o mesmo critério do DRE:
 * competência e valor original dos títulos a pagar (com rateio), sem cancelados e sem o título da
 * fatura de cartão, mais as compras no cartão pela categoria de cada uma.
 * Devolve todas as categorias de gasto ativas, para a tela poder orçar também as que ainda não têm valor.
 */
export async function getBudgetReport(userId: string, companyId: string, periodValue: string) {
  const parsed = period.parse(periodValue);
  await assertActiveMembership(userId, companyId);

  const [year, month] = parsed.split("-").map(Number) as [number, number];
  const range = { gte: new Date(Date.UTC(year, month - 1, 1)), lte: new Date(Date.UTC(year, month, 0)) };

  const { categories, budgets, titles, purchases } = await withCompanyContext(userId, companyId, async (tx) => ({
    categories: await tx.category.findMany({
      where: { companyId, status: "ACTIVE", nature: { in: [...SPENDING_NATURES] } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    budgets: await tx.budget.findMany({ where: { companyId, period: parsed } }),
    titles: await tx.title.findMany({
      where: { companyId, type: "PAYABLE", deletedAt: null, status: { not: "CANCELLED" }, competenceDate: range, creditCardInvoice: null },
      select: { categoryId: true, originalAmountCents: true, allocations: { select: { categoryId: true, amountCents: true } } },
    }),
    purchases: await tx.creditCardPurchase.findMany({
      where: { companyId, canceledAt: null, competenceDate: range },
      select: { categoryId: true, amountCents: true },
    }),
  }));

  const actual = new Map<string, bigint>();
  const addActual = (categoryId: string, cents: bigint) => actual.set(categoryId, (actual.get(categoryId) ?? BigInt(0)) + cents);
  for (const title of titles) {
    if (title.allocations.length > 0) for (const line of title.allocations) addActual(line.categoryId, line.amountCents);
    else addActual(title.categoryId, title.originalAmountCents);
  }
  for (const purchase of purchases) addActual(purchase.categoryId, purchase.amountCents);
  const planned = new Map(budgets.map((budget) => [budget.categoryId, budget.amountCents]));

  const rows: BudgetRow[] = categories.map((category) => {
    const plannedCents = planned.get(category.id) ?? BigInt(0);
    const actualCents = actual.get(category.id) ?? BigInt(0);
    return {
      categoryId: category.id,
      name: category.name,
      parentId: category.parentId,
      plannedCents,
      actualCents,
      remainingCents: plannedCents - actualCents,
      percent: plannedCents > BigInt(0) ? Number((actualCents * BigInt(1000)) / plannedCents) / 10 : 0,
      status: budgetStatus(plannedCents, actualCents),
    };
  });

  const budgeted = rows.filter((row) => row.plannedCents > BigInt(0));
  const plannedTotal = budgeted.reduce((sum, row) => sum + row.plannedCents, BigInt(0));
  const actualOnBudgeted = budgeted.reduce((sum, row) => sum + row.actualCents, BigInt(0));
  return {
    period: parsed,
    rows,
    totals: {
      plannedCents: plannedTotal,
      /** Realizado só das categorias orçadas, para comparar com o planejado. */
      actualOnBudgetedCents: actualOnBudgeted,
      /** Gasto do mês em categorias sem orçamento. */
      unbudgetedActualCents: rows.filter((row) => row.plannedCents === BigInt(0)).reduce((sum, row) => sum + row.actualCents, BigInt(0)),
      overCount: rows.filter((row) => row.status === "OVER").length,
      warningCount: rows.filter((row) => row.status === "WARNING").length,
    },
  };
}

const yearInput = z.number().int().min(2000).max(2100);
const monthsOf = (year: number) => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);

/** Realizado por categoria e mês num intervalo, com o mesmo critério do relatório mensal (competência, rateio, compras de cartão). */
async function actualByCategoryAndMonth(tx: TenantScopedClient, companyId: string, from: Date, to: Date) {
  const [titles, purchases] = await Promise.all([
    tx.title.findMany({
      where: { companyId, type: "PAYABLE", deletedAt: null, status: { not: "CANCELLED" }, competenceDate: { gte: from, lte: to }, creditCardInvoice: null },
      select: { categoryId: true, competenceDate: true, originalAmountCents: true, allocations: { select: { categoryId: true, amountCents: true } } },
    }),
    tx.creditCardPurchase.findMany({
      where: { companyId, canceledAt: null, competenceDate: { gte: from, lte: to } },
      select: { categoryId: true, competenceDate: true, amountCents: true },
    }),
  ]);
  const actual = new Map<string, bigint>();
  const add = (categoryId: string, date: Date, cents: bigint) => {
    const key = `${categoryId}|${date.toISOString().slice(0, 7)}`;
    actual.set(key, (actual.get(key) ?? BigInt(0)) + cents);
  };
  for (const title of titles) {
    if (title.allocations.length > 0) for (const line of title.allocations) add(line.categoryId, title.competenceDate, line.amountCents);
    else add(title.categoryId, title.competenceDate, title.originalAmountCents);
  }
  for (const purchase of purchases) add(purchase.categoryId, purchase.competenceDate, purchase.amountCents);
  return actual;
}

/**
 * Orçamento do ano: para cada categoria de gasto, o planejado e o realizado de cada mês, e o total
 * do ano. Mesmo critério de realizado do relatório mensal.
 */
export async function getAnnualBudgetReport(userId: string, companyId: string, rawYear: number) {
  const year = yearInput.parse(rawYear);
  await assertActiveMembership(userId, companyId);
  const months = monthsOf(year);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31));
  return withCompanyContext(userId, companyId, async (tx) => {
    const [categories, budgets, actual] = await Promise.all([
      tx.category.findMany({ where: { companyId, status: "ACTIVE", nature: { in: [...SPENDING_NATURES] } }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
      tx.budget.findMany({ where: { companyId, period: { in: months } } }),
      actualByCategoryAndMonth(tx, companyId, from, to),
    ]);
    const planned = new Map(budgets.map((budget) => [`${budget.categoryId}|${budget.period}`, budget.amountCents]));
    const ZERO = BigInt(0);
    const rows = categories.map((category) => {
      const cells = months.map((month) => ({
        period: month,
        plannedCents: planned.get(`${category.id}|${month}`) ?? ZERO,
        actualCents: actual.get(`${category.id}|${month}`) ?? ZERO,
      }));
      const plannedCents = cells.reduce((sum, cell) => sum + cell.plannedCents, ZERO);
      const actualCents = cells.reduce((sum, cell) => sum + cell.actualCents, ZERO);
      return {
        categoryId: category.id,
        name: category.name,
        parentId: category.parentId,
        cells,
        plannedCents,
        actualCents,
        percent: plannedCents > ZERO ? Number((actualCents * BigInt(1000)) / plannedCents) / 10 : 0,
        status: budgetStatus(plannedCents, actualCents),
      };
    });
    const monthTotals = months.map((month, index) => ({
      period: month,
      plannedCents: rows.reduce((sum, row) => sum + row.cells[index]!.plannedCents, ZERO),
      actualCents: rows.reduce((sum, row) => sum + row.cells[index]!.actualCents, ZERO),
    }));
    return {
      year,
      months,
      rows,
      monthTotals,
      totals: {
        plannedCents: rows.reduce((sum, row) => sum + row.plannedCents, ZERO),
        actualCents: rows.reduce((sum, row) => sum + row.actualCents, ZERO),
        overCount: rows.filter((row) => row.status === "OVER").length,
      },
    };
  });
}

export const saveBudgetCellsInput = z.object({
  cells: z.array(z.object({ categoryId: z.string().uuid(), period, amountCents: z.number().int().min(0) })).max(2000),
});

/** Grava várias células de orçamento de uma vez (a grade do ano), numa transação; 0 remove. */
export async function saveBudgetCells(userId: string, companyId: string, rawInput: unknown) {
  const { cells } = saveBudgetCellsInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  if (cells.length === 0) return { saved: 0 };
  return withCompanyContext(userId, companyId, async (tx) => {
    const ids = [...new Set(cells.map((cell) => cell.categoryId))];
    const valid = await tx.category.findMany({ where: { id: { in: ids }, companyId, status: "ACTIVE", nature: { in: [...SPENDING_NATURES] } }, select: { id: true } });
    if (valid.length !== ids.length) throw new CategoryNotFoundError();
    for (const cell of cells) {
      if (cell.amountCents === 0) {
        await tx.budget.deleteMany({ where: { companyId, categoryId: cell.categoryId, period: cell.period } });
      } else {
        await tx.budget.upsert({
          where: { companyId_categoryId_period: { companyId, categoryId: cell.categoryId, period: cell.period } },
          create: { companyId, categoryId: cell.categoryId, period: cell.period, amountCents: BigInt(cell.amountCents), createdByUserId: userId },
          update: { amountCents: BigInt(cell.amountCents) },
        });
      }
    }
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "BUDGET_SET", resourceType: "Company", resourceId: companyId,
      summary: `Orçamento: ${cells.length} ${cells.length === 1 ? "valor alterado" : "valores alterados"}`, metadata: { cells: cells.length },
    });
    return { saved: cells.length };
  });
}

export const fillBudgetYearInput = z.object({
  year: yearInput,
  /**
   * COPY_MONTH: o orçamento de `sourcePeriod` vira o de todos os meses do ano;
   * PREVIOUS_YEAR: cada mês repete o orçado no mesmo mês do ano anterior;
   * PREVIOUS_YEAR_ACTUAL: cada mês parte do que foi gasto de verdade no mesmo mês do ano anterior.
   */
  mode: z.enum(["COPY_MONTH", "PREVIOUS_YEAR", "PREVIOUS_YEAR_ACTUAL"]),
  sourcePeriod: period.optional(),
  /** Reajuste em pontos-base (1000 = +10%, -500 = -5%). */
  adjustmentBps: z.number().int().min(-9000).max(50000).default(0),
  /** Sem sobrescrever, só preenche os meses/categorias que estão em branco. */
  overwrite: z.boolean().default(false),
}).refine((value) => value.mode !== "COPY_MONTH" || Boolean(value.sourcePeriod), { message: "Escolha o mês de origem.", path: ["sourcePeriod"] });

/** Aplica o reajuste e arredonda para reais inteiros (orçamento é planejamento); sem reajuste, copia o valor exato. */
export function adjustBudgetAmount(cents: bigint, bps: number): bigint {
  if (bps === 0) return cents;
  const value = (cents * BigInt(10000 + bps)) / BigInt(10000);
  return ((value + BigInt(50)) / BigInt(100)) * BigInt(100);
}

/** Planejar o ano de uma vez: copiar um mês, repetir o ano anterior ou partir do gasto real, com reajuste opcional. */
export async function fillBudgetYear(userId: string, companyId: string, rawInput: unknown) {
  const data = fillBudgetYearInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  const months = monthsOf(data.year);
  return withCompanyContext(userId, companyId, async (tx) => {
    const categories = await tx.category.findMany({ where: { companyId, status: "ACTIVE", nature: { in: [...SPENDING_NATURES] } }, select: { id: true } });
    const active = new Set(categories.map((category) => category.id));
    const existing = await tx.budget.findMany({ where: { companyId, period: { in: months } }, select: { categoryId: true, period: true } });
    const taken = new Set(existing.map((row) => `${row.categoryId}|${row.period}`));

    // origem: valor por categoria e mês de destino
    const source = new Map<string, bigint>();
    if (data.mode === "COPY_MONTH") {
      const rows = await tx.budget.findMany({ where: { companyId, period: data.sourcePeriod! } });
      for (const month of months) for (const row of rows) source.set(`${row.categoryId}|${month}`, row.amountCents);
    } else if (data.mode === "PREVIOUS_YEAR") {
      const rows = await tx.budget.findMany({ where: { companyId, period: { in: monthsOf(data.year - 1) } } });
      for (const row of rows) source.set(`${row.categoryId}|${data.year}${row.period.slice(4)}`, row.amountCents);
    } else {
      const actual = await actualByCategoryAndMonth(tx, companyId, new Date(Date.UTC(data.year - 1, 0, 1)), new Date(Date.UTC(data.year - 1, 11, 31)));
      for (const [key, cents] of actual) {
        const [categoryId, previousMonth] = key.split("|") as [string, string];
        source.set(`${categoryId}|${data.year}${previousMonth.slice(4)}`, cents);
      }
    }

    let written = 0;
    for (const [key, cents] of source) {
      const [categoryId, month] = key.split("|") as [string, string];
      if (!active.has(categoryId) || cents <= BigInt(0)) continue;
      // o próprio mês de origem só muda se houver reajuste
      if (data.mode === "COPY_MONTH" && month === data.sourcePeriod && !data.adjustmentBps) continue;
      if (!data.overwrite && taken.has(key) && !(data.mode === "COPY_MONTH" && month === data.sourcePeriod)) continue;
      const amount = adjustBudgetAmount(cents, data.adjustmentBps);
      if (amount <= BigInt(0)) continue;
      await tx.budget.upsert({
        where: { companyId_categoryId_period: { companyId, categoryId, period: month } },
        create: { companyId, categoryId, period: month, amountCents: amount, createdByUserId: userId },
        update: { amountCents: amount },
      });
      written += 1;
    }
    if (written > 0) {
      const how = data.mode === "COPY_MONTH" ? `cópia de ${data.sourcePeriod}` : data.mode === "PREVIOUS_YEAR" ? "repetindo o ano anterior" : "pelo gasto real do ano anterior";
      await recordAuditEvent(tx, {
        companyId, actorUserId: userId, eventType: "BUDGET_COPIED", resourceType: "Company", resourceId: companyId,
        summary: `Orçamento de ${data.year} planejado (${how}${data.adjustmentBps ? `, reajuste ${data.adjustmentBps / 100}%` : ""})`,
        metadata: { written, adjustmentBps: data.adjustmentBps },
      });
    }
    return { written };
  });
}
