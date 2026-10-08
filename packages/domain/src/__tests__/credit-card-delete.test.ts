import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { listAuditEvents } from "../audit/list-audit-events";
import { createCreditCard, createCreditCardPurchase, deleteCreditCard, getCreditCard, listCreditCards, payCreditCardInvoice } from "../credit-cards";
import { CreditCardHasPaymentsError, CreditCardNotFoundError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

const CARD = { name: "Nubank", brand: "MASTERCARD", lastDigits: "1234", limitCents: 500_000, closingDay: 10, dueDay: 20 } as const;

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const category = await createCategory(user.id, company.id, { name: "Mercado", nature: "EXPENSE" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 1_000_000, openingDate: "2026-01-01" });
  const card = await createCreditCard(user.id, company.id, CARD);
  return { user, company, category, account, card };
}

const buy = (ctx: Awaited<ReturnType<typeof setup>>, totalAmountCents = 10_000) =>
  createCreditCardPurchase(ctx.user.id, ctx.company.id, { cardId: ctx.card.id, description: "Compras do mês", categoryId: ctx.category.id, totalAmountCents, purchaseDate: "2026-01-05" });

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("excluir cartão de crédito", () => {
  it("exclui um cartão sem movimento", async () => {
    const ctx = await setup("vazio");
    const removed = await deleteCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);

    expect(removed).toMatchObject({ name: "Nubank", purchases: 0, invoices: 0 });
    expect(await listCreditCards(ctx.user.id, ctx.company.id)).toHaveLength(0);
    await expect(getCreditCard(ctx.user.id, ctx.company.id, ctx.card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });

  it("exclui junto compras, faturas e os títulos das faturas, e as compras saem do DRE", async () => {
    const ctx = await setup("com-compras");
    await buy(ctx, 10_000);
    await buy(ctx, 5_000);
    const before = await getManagerialIncomeStatement(ctx.user.id, ctx.company.id, { from: "2026-01-01", to: "2026-01-31" });
    expect(before.groups.length).toBeGreaterThan(0);

    const removed = await deleteCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);

    expect(removed).toMatchObject({ purchases: 2, activePurchases: 2, activePurchasesCents: "15000", invoices: 1 });
    expect(await rootClient.creditCardPurchase.count({ where: { companyId: ctx.company.id } })).toBe(0);
    expect(await rootClient.creditCardInvoice.count({ where: { companyId: ctx.company.id } })).toBe(0);
    expect(await rootClient.title.count({ where: { companyId: ctx.company.id } })).toBe(0);
    const after = await getManagerialIncomeStatement(ctx.user.id, ctx.company.id, { from: "2026-01-01", to: "2026-01-31" });
    expect(after.groups).toHaveLength(0);
    const events = await listAuditEvents(ctx.user.id, ctx.company.id, { resourceType: "CreditCard", resourceId: ctx.card.id });
    expect(events.map((event) => event.eventType)).toContain("CREDIT_CARD_DELETED");
  });

  it("recusa excluir quando uma fatura já teve pagamento, e nada é apagado", async () => {
    const ctx = await setup("paga");
    const [purchase] = await buy(ctx, 10_000);
    await payCreditCardInvoice(ctx.user.id, ctx.company.id, purchase!.invoiceId, { financialAccountId: ctx.account.id, effectiveDate: "2026-01-20" });

    await expect(deleteCreditCard(ctx.user.id, ctx.company.id, ctx.card.id)).rejects.toBeInstanceOf(CreditCardHasPaymentsError);

    expect(await listCreditCards(ctx.user.id, ctx.company.id)).toHaveLength(1);
    expect(await rootClient.creditCardPurchase.count({ where: { companyId: ctx.company.id } })).toBe(1);
  });

  it("não alcança cartão de outra empresa", async () => {
    const mine = await setup("minha");
    const other = await setup("outra");
    await expect(deleteCreditCard(mine.user.id, mine.company.id, other.card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    expect(await listCreditCards(other.user.id, other.company.id)).toHaveLength(1);
  });
});
