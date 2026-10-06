import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
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
