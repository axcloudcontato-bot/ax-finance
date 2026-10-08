import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createParty } from "../parties/create-party";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { createCreditCard, createCreditCardPurchase } from "../credit-cards";
import { getDashboardInsights } from "../reports/dashboard-insights";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 1_000_000, openingDate: "2026-01-01" });
  const sales = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  const food = await createCategory(user.id, company.id, { name: "Mercado", nature: "EXPENSE" });
  const rent = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  const loan = await createCategory(user.id, company.id, { name: "Empréstimo", nature: "FINANCING" });
  return { user, company, account, sales, food, rent, loan };
}

type Ctx = Awaited<ReturnType<typeof setup>>;
const title = (ctx: Ctx, type: "RECEIVABLE" | "PAYABLE", categoryId: string, cents: number, competenceDate: string, dueDate: string, extra: Record<string, unknown> = {}) =>
  createTitle(ctx.user.id, ctx.company.id, { type, description: `${type} ${cents}`, categoryId, originalAmountCents: cents, competenceDate, dueDate, ...extra });

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("indicadores de gestão do dashboard", () => {
  it("resultado por competência: receita menos despesa operacional, com a compra do cartão pela categoria e sem a fatura nem o financiamento", async () => {
    const ctx = await setup("resultado");
    await title(ctx, "RECEIVABLE", ctx.sales.id, 100_000, "2026-09-10", "2026-09-30");
    await title(ctx, "PAYABLE", ctx.rent.id, 30_000, "2026-09-05", "2026-09-10");
    await title(ctx, "PAYABLE", ctx.loan.id, 500_000, "2026-09-06", "2026-09-10"); // financiamento: fora do resultado
    const card = await createCreditCard(ctx.user.id, ctx.company.id, { name: "Nubank", brand: "VISA", limitCents: 500_000, closingDay: 10, dueDay: 20 });
    await createCreditCardPurchase(ctx.user.id, ctx.company.id, { cardId: card.id, description: "Compras", categoryId: ctx.food.id, totalAmountCents: 20_000, purchaseDate: "2026-09-02" });

    const insights = await getDashboardInsights(ctx.user.id, ctx.company.id, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30" });

    expect(insights.period).toMatchObject({ revenueCents: 100_000n, expenseCents: 50_000n, resultCents: 50_000n, marginBps: 5_000 });
    // O gasto do cartão aparece como "Mercado", nunca como fatura.
    expect(insights.expenseByCategory.map((row) => [row.name, row.cents])).toEqual([["Aluguel", 30_000n], ["Mercado", 20_000n]]);
    expect(insights.expenseByCategory[0]!.shareBps).toBe(6_000);
    expect(insights.revenueByCategory).toMatchObject([{ name: "Vendas", cents: 100_000n, shareBps: 10_000 }]);
  });

  it("série dos últimos 6 meses e comparação com o período anterior", async () => {
    const ctx = await setup("serie");
    await title(ctx, "RECEIVABLE", ctx.sales.id, 80_000, "2026-08-15", "2026-08-20");
    await title(ctx, "RECEIVABLE", ctx.sales.id, 120_000, "2026-09-15", "2026-09-20");
    await title(ctx, "PAYABLE", ctx.rent.id, 40_000, "2026-09-05", "2026-09-10");

    const insights = await getDashboardInsights(ctx.user.id, ctx.company.id, {
      from: "2026-09-01", to: "2026-09-30", comparisonFrom: "2026-08-01", comparisonTo: "2026-08-31", today: "2026-09-30",
    });

    expect(insights.monthly.map((month) => month.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(insights.monthly.at(-1)).toMatchObject({ revenueCents: 120_000n, expenseCents: 40_000n, resultCents: 80_000n });
    expect(insights.monthly.at(-2)).toMatchObject({ revenueCents: 80_000n, resultCents: 80_000n });
    expect(insights.comparison).toMatchObject({ revenueCents: 80_000n, expenseCents: 0n });
  });

  it("saúde do caixa: inadimplência, prazos médios, saída dos últimos 90 dias e concentração no maior cliente", async () => {
    const ctx = await setup("saude");
    const big = await createParty(ctx.user.id, ctx.company.id, { name: "Cliente Grande", isClient: true });
    const small = await createParty(ctx.user.id, ctx.company.id, { name: "Cliente Pequeno", isClient: true });
    const received = await title(ctx, "RECEIVABLE", ctx.sales.id, 60_000, "2026-09-01", "2026-09-10", { partyId: big.id });
    await title(ctx, "RECEIVABLE", ctx.sales.id, 20_000, "2026-09-02", "2026-09-05", { partyId: big.id }); // vencido
    await title(ctx, "RECEIVABLE", ctx.sales.id, 20_000, "2026-09-03", "2026-10-30", { partyId: small.id }); // a vencer
    const paid = await title(ctx, "PAYABLE", ctx.rent.id, 30_000, "2026-09-01", "2026-09-04");
    await registerSettlement(ctx.user.id, ctx.company.id, received.id, { financialAccountId: ctx.account.id, principalAmountCents: 60_000, effectiveDate: "2026-09-11" });
    await registerSettlement(ctx.user.id, ctx.company.id, paid.id, { financialAccountId: ctx.account.id, principalAmountCents: 30_000, effectiveDate: "2026-09-21" });

    const { health } = await getDashboardInsights(ctx.user.id, ctx.company.id, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30" });

    // Em aberto: 20 mil vencidos + 20 mil a vencer; metade está vencida.
    expect(health).toMatchObject({ openReceivableCents: 40_000n, overdueReceivableCents: 20_000n, delinquencyBps: 5_000 });
    expect(health.averageReceiveDays).toBe(10); // 01/09 até 11/09
    expect(health.averagePayDays).toBe(20); // 01/09 até 21/09
    expect(health.outflow90Cents).toBe(30_000n);
    // Cliente Grande: 80 mil de 100 mil de receita.
    expect(health.topClient).toMatchObject({ name: "Cliente Grande", shareBps: 8_000 });
  });

  it("sem movimento não inventa números: margem e prazos ficam vazios", async () => {
    const ctx = await setup("vazio");
    const insights = await getDashboardInsights(ctx.user.id, ctx.company.id, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30" });
    expect(insights.period).toMatchObject({ revenueCents: 0n, resultCents: 0n, marginBps: null });
    expect(insights.health).toMatchObject({ delinquencyBps: 0, averageReceiveDays: null, averagePayDays: null, topClient: null });
    expect(insights.expenseByCategory).toEqual([]);
  });

  it("não mistura empresas", async () => {
    const mine = await setup("minha");
    const other = await setup("outra");
    await title(other, "RECEIVABLE", other.sales.id, 999_000, "2026-09-10", "2026-09-30");
    const insights = await getDashboardInsights(mine.user.id, mine.company.id, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30" });
    expect(insights.period.revenueCents).toBe(0n);
  });
});

describe("horizonte da projeção de caixa", () => {
  it("aceita 30, 60 e 90 dias e estende a série e a data final", async () => {
    const ctx = await setup("horizonte");
    const base = { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30" };
    const d30 = await getDashboardOverview(ctx.user.id, ctx.company.id, base);
    const d90 = await getDashboardOverview(ctx.user.id, ctx.company.id, { ...base, projectionDays: 90 });
    expect(d30.projectionEnd).toBe("2026-10-30");
    expect(d30.cashProjectionSeries).toHaveLength(31);
    expect(d90.projectionEnd).toBe("2026-12-29");
    expect(d90.cashProjectionSeries).toHaveLength(91);
    await expect(getDashboardOverview(ctx.user.id, ctx.company.id, { ...base, projectionDays: 45 })).rejects.toThrow();
  });
});
