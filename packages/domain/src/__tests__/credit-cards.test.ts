import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { acceptCompanyInvitation, createCompanyInvitation, listCompanyMembers, updateCompanyMemberAccess } from "../companies/members";
import { resetCompanyLedger } from "../companies/reset-company-ledger";
import { createCategory } from "../categories/create-category";
import { createCostCenter } from "../cost-centers/cost-centers";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { listFinancialAccountsWithBalance } from "../financial-accounts/account-balances";
import { cancelTitle } from "../titles/cancel-title";
import { deleteTitle } from "../titles/delete-title";
import { duplicateTitle } from "../titles/duplicate-title";
import { updateTitle } from "../titles/update-title";
import { registerSettlement } from "../titles/register-settlement";
import { applyTitleBatch, previewTitleBatch } from "../titles/title-batch";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { listAuditEvents } from "../audit/list-audit-events";
import {
  archiveCreditCard,
  cancelCreditCardPurchase,
  createCreditCard,
  createCreditCardPurchase,
  getCreditCard,
  getCreditCardInvoice,
  listCreditCards,
  payCreditCardInvoice,
  reactivateCreditCard,
  updateCreditCard,
  updateCreditCardPurchase,
} from "../credit-cards";
import {
  CreditCardAccessRestrictedError,
  CreditCardCategoryInvalidError,
  CreditCardHasOpenInvoicesError,
  CreditCardInstallmentCountInvalidError,
  CreditCardInvoiceBelowSettledError,
  CreditCardInvoiceNotPayableError,
  CreditCardInvoicePaidError,
  CreditCardNotFoundError,
  CreditCardPurchaseAlreadyCanceledError,
  TitleManagedByCreditCardError,
} from "../errors";
import { rootClient, resetDatabase } from "./test-db";

function uniqueEmail(label: string) {
  return `${label}.${randomUUID()}@teste.ax.finance`;
}

// Cartão que fecha dia 10 e vence dia 20. Compra em 2026-01-05 cai na fatura de janeiro
// (fecha 10/01, vence 20/01), já vencida na data real dos testes, portanto paga-se sem esperar.
const CARD = { name: "Nubank", brand: "MASTERCARD", lastDigits: "1234", limitCents: 500_000, closingDay: 10, dueDay: 20 } as const;
const PAST_PURCHASE = "2026-01-05";

async function setup(label: string) {
  const user = await registerUser({ email: uniqueEmail(label), name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const category = await createCategory(user.id, company.id, { name: "Mercado", nature: "EXPENSE" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 1_000_000, openingDate: "2026-01-01" });
  const card = await createCreditCard(user.id, company.id, CARD);
  return { user, company, category, account, card };
}

async function buy(ctx: Awaited<ReturnType<typeof setup>>, overrides: Record<string, unknown> = {}) {
  return createCreditCardPurchase(ctx.user.id, ctx.company.id, {
    cardId: ctx.card.id,
    description: "Compras do mês",
    categoryId: ctx.category.id,
    totalAmountCents: 10_000,
    purchaseDate: PAST_PURCHASE,
    ...overrides,
  });
}

async function invoiceTitle(companyId: string, referenceMonth: string) {
  const invoice = await rootClient.creditCardInvoice.findFirstOrThrow({ where: { companyId, referenceMonth }, include: { title: true } });
  return invoice.title;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("cadastro do cartão", () => {
  it("grava o cartão e a auditoria, validando os dias, o limite e os 4 últimos dígitos", async () => {
    const { user, company, card } = await setup("cadastro");
    expect(card).toMatchObject({ name: "Nubank", closingDay: 10, dueDay: 20, limitCents: BigInt(500_000), status: "ACTIVE" });

    await expect(createCreditCard(user.id, company.id, { ...CARD, closingDay: 32 })).rejects.toThrow();
    await expect(createCreditCard(user.id, company.id, { ...CARD, closingDay: 0 })).rejects.toThrow();
    await expect(createCreditCard(user.id, company.id, { ...CARD, limitCents: 0 })).rejects.toThrow();
    await expect(createCreditCard(user.id, company.id, { ...CARD, lastDigits: "12345678" })).rejects.toThrow();

    const events = await listAuditEvents(user.id, company.id, {});
    expect(events.some((event) => event.eventType === "CREDIT_CARD_CREATED")).toBe(true);
  });

  it("só aceita como conta padrão de pagamento uma conta ativa da própria empresa", async () => {
    const { user, company } = await setup("conta-padrao");
    const other = await setup("conta-outra");
    await expect(createCreditCard(user.id, company.id, { ...CARD, defaultPaymentAccountId: other.account.id })).rejects.toThrow();
  });
});

describe("compra no cartão soma na fatura", () => {
  it("cria a fatura do ciclo com um título a pagar e soma as compras seguintes no mesmo título", async () => {
    const ctx = await setup("soma");
    await buy(ctx, { description: "Supermercado", totalAmountCents: 15_000 });
    await buy(ctx, { description: "Farmácia", totalAmountCents: 4_990, purchaseDate: "2026-01-09" });

    const invoices = await rootClient.creditCardInvoice.findMany({ where: { companyId: ctx.company.id }, include: { title: true } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ referenceMonth: "2026-01" });
    expect(invoices[0]!.closingDate.toISOString().slice(0, 10)).toBe("2026-01-10");
    expect(invoices[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-20");
    expect(invoices[0]!.title).toMatchObject({ type: "PAYABLE", originalAmountCents: BigInt(19_990), status: "OPEN", description: "Fatura Nubank · 01/2026" });
    expect(invoices[0]!.title.dueDate.toISOString().slice(0, 10)).toBe("2026-01-20");
  });

  it("compra no dia do fechamento ou depois cai na fatura seguinte", async () => {
    const ctx = await setup("fechamento");
    await buy(ctx, { purchaseDate: "2026-01-10" });
    const invoice = await rootClient.creditCardInvoice.findFirstOrThrow({ where: { companyId: ctx.company.id } });
    expect(invoice.referenceMonth).toBe("2026-02");
  });

  it("parcela em N faturas, com o resto nas primeiras parcelas e a competência andando um mês por parcela", async () => {
    const ctx = await setup("parcelas");
    const purchases = await buy(ctx, { description: "Notebook", totalAmountCents: 10_000, installmentCount: 3 });

    expect(purchases.map((purchase) => Number(purchase.amountCents))).toEqual([3334, 3333, 3333]);
    expect(purchases.map((purchase) => `${purchase.installmentNumber}/${purchase.installmentCount}`)).toEqual(["1/3", "2/3", "3/3"]);
    expect(new Set(purchases.map((purchase) => purchase.installmentGroupId)).size).toBe(1);
    expect(purchases.map((purchase) => purchase.competenceDate.toISOString().slice(0, 10))).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);

    const invoices = await rootClient.creditCardInvoice.findMany({ where: { companyId: ctx.company.id }, include: { title: true }, orderBy: { dueDate: "asc" } });
    expect(invoices.map((invoice) => invoice.referenceMonth)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(invoices.map((invoice) => Number(invoice.title.originalAmountCents))).toEqual([3334, 3333, 3333]);
  });

  it("recusa categoria de receita e a categoria da própria fatura, e parcelas menores que um centavo", async () => {
    const ctx = await setup("categoria");
    const revenue = await createCategory(ctx.user.id, ctx.company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
    await expect(buy(ctx, { categoryId: revenue.id })).rejects.toBeInstanceOf(CreditCardCategoryInvalidError);

    await buy(ctx);
    const invoiceCategory = await rootClient.category.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "Fatura de cartão de crédito" } });
    await expect(buy(ctx, { categoryId: invoiceCategory.id })).rejects.toBeInstanceOf(CreditCardCategoryInvalidError);

    await expect(buy(ctx, { totalAmountCents: 2, installmentCount: 3 })).rejects.toBeInstanceOf(CreditCardInstallmentCountInvalidError);
  });

  it("é idempotente: repetir a mesma chave não duplica a compra nem soma duas vezes", async () => {
    const ctx = await setup("idempotencia");
    const key = randomUUID();
    const first = await buy(ctx, { idempotencyKey: key, installmentCount: 2, totalAmountCents: 9_000 });
    const second = await buy(ctx, { idempotencyKey: key, installmentCount: 2, totalAmountCents: 9_000 });

    expect(second.map((purchase) => purchase.id)).toEqual(first.map((purchase) => purchase.id));
    expect(await rootClient.creditCardPurchase.count({ where: { companyId: ctx.company.id } })).toBe(2);
    expect(Number((await invoiceTitle(ctx.company.id, "2026-01")).originalAmountCents)).toBe(4_500);
  });

  it("lançamentos simultâneos no mesmo ciclo criam uma só fatura e somam tudo", async () => {
    const ctx = await setup("concorrencia");
    await Promise.all(Array.from({ length: 6 }, (_, index) => buy(ctx, { description: `Compra ${index}`, totalAmountCents: 1_000 + index })));

    expect(await rootClient.creditCardInvoice.count({ where: { companyId: ctx.company.id } })).toBe(1);
    expect(Number((await invoiceTitle(ctx.company.id, "2026-01")).originalAmountCents)).toBe(6_000 + 15);
  });

  it("não aceita lançar em cartão arquivado nem de outra empresa", async () => {
    const ctx = await setup("arquivado");
    const other = await setup("outra");
    await expect(buy({ ...ctx, card: other.card })).rejects.toBeInstanceOf(CreditCardNotFoundError);

    await archiveCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);
    await expect(buy(ctx)).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });
});

describe("cancelar e editar compras", () => {
  it("cancelar tira da fatura; fatura sem compras vira título cancelado e some das telas; voltar a lançar reabre", async () => {
    const ctx = await setup("cancelar");
    const [only] = await buy(ctx, { totalAmountCents: 8_000 });

    await cancelCreditCardPurchase(ctx.user.id, ctx.company.id, only!.id, { reason: "Lançada por engano" });
    let title = await invoiceTitle(ctx.company.id, "2026-01");
    expect(title).toMatchObject({ status: "CANCELLED", originalAmountCents: BigInt(0) });
    expect(title.deletedAt).not.toBeNull();
    const emptyInvoice = await rootClient.creditCardInvoice.findFirstOrThrow({ where: { companyId: ctx.company.id, referenceMonth: "2026-01" } });
    expect((await getCreditCardInvoice(ctx.user.id, ctx.company.id, emptyInvoice.id)).invoice.stage).toBe("EMPTY");

    await buy(ctx, { totalAmountCents: 3_000 });
    title = await invoiceTitle(ctx.company.id, "2026-01");
    expect(title).toMatchObject({ status: "OPEN", originalAmountCents: BigInt(3_000), deletedAt: null });

    await expect(cancelCreditCardPurchase(ctx.user.id, ctx.company.id, only!.id, { reason: "de novo" })).rejects.toBeInstanceOf(CreditCardPurchaseAlreadyCanceledError);
  });

  it("cancelar parcela com 'e as seguintes' mantém as anteriores", async () => {
    const ctx = await setup("cancelar-grupo");
    const purchases = await buy(ctx, { totalAmountCents: 9_000, installmentCount: 3 });

    const result = await cancelCreditCardPurchase(ctx.user.id, ctx.company.id, purchases[1]!.id, { reason: "Devolvido", includeFollowingInstallments: true });
    expect(result.canceledCount).toBe(2);

    expect(Number((await invoiceTitle(ctx.company.id, "2026-01")).originalAmountCents)).toBe(3_000);
    expect((await invoiceTitle(ctx.company.id, "2026-02")).status).toBe("CANCELLED");
    expect((await invoiceTitle(ctx.company.id, "2026-03")).status).toBe("CANCELLED");
  });

  it("editar muda descrição e classificação sem mexer em valor nem fatura; categoria inválida é recusada", async () => {
    const ctx = await setup("editar");
    const [purchase] = await buy(ctx);
    const other = await createCategory(ctx.user.id, ctx.company.id, { name: "Lazer", nature: "EXPENSE" });
    const center = await createCostCenter(ctx.user.id, ctx.company.id, { name: "Casa" });

    const updated = await updateCreditCardPurchase(ctx.user.id, ctx.company.id, purchase!.id, { description: "Cinema", categoryId: other.id, costCenterId: center.id });
    expect(updated).toMatchObject({ description: "Cinema", categoryId: other.id, costCenterId: center.id, amountCents: purchase!.amountCents, invoiceId: purchase!.invoiceId });

    const revenue = await createCategory(ctx.user.id, ctx.company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
    await expect(updateCreditCardPurchase(ctx.user.id, ctx.company.id, purchase!.id, { description: "x", categoryId: revenue.id })).rejects.toBeInstanceOf(CreditCardCategoryInvalidError);
  });
});

describe("pagamento da fatura", () => {
  it("paga a fatura fechada por uma baixa comum: sai dinheiro da conta, título quitado e fatura travada", async () => {
    const ctx = await setup("pagar");
    await buy(ctx, { totalAmountCents: 20_000 });
    const detail = await getCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);
    const invoiceId = detail.invoices[0]!.id;
    expect(detail.invoices[0]).toMatchObject({ stage: "OVERDUE", remainingCents: BigInt(20_000) });

    const settlement = await payCreditCardInvoice(ctx.user.id, ctx.company.id, invoiceId, { financialAccountId: ctx.account.id, effectiveDate: "2026-01-20" });
    expect(Number(settlement.principalAmountCents)).toBe(20_000);

    const accounts = await listFinancialAccountsWithBalance(ctx.user.id, ctx.company.id);
    expect(Number(accounts.find((account) => account.id === ctx.account.id)!.currentBalanceCents)).toBe(980_000);
    expect((await invoiceTitle(ctx.company.id, "2026-01")).status).toBe("SETTLED");

    const after = await getCreditCardInvoice(ctx.user.id, ctx.company.id, invoiceId);
    expect(after.invoice).toMatchObject({ stage: "PAID", remainingCents: BigInt(0), paidCents: BigInt(20_000) });
    expect(after.payments).toHaveLength(1);

    await expect(buy(ctx, { purchaseDate: "2026-01-06" })).rejects.toBeInstanceOf(CreditCardInvoicePaidError);
    const [purchase] = after.purchases;
    await expect(cancelCreditCardPurchase(ctx.user.id, ctx.company.id, purchase!.id, { reason: "tentativa" })).rejects.toBeInstanceOf(CreditCardInvoicePaidError);
    await expect(payCreditCardInvoice(ctx.user.id, ctx.company.id, invoiceId, { financialAccountId: ctx.account.id, effectiveDate: "2026-01-21" })).rejects.toBeInstanceOf(CreditCardInvoicePaidError);
  });

  it("aceita pagamento parcial com juros; compra nova entra no saldo e cancelar abaixo do já pago é recusado", async () => {
    const ctx = await setup("parcial");
    const [first] = await buy(ctx, { totalAmountCents: 20_000 });
    const invoiceId = (await getCreditCard(ctx.user.id, ctx.company.id, ctx.card.id)).invoices[0]!.id;

    await payCreditCardInvoice(ctx.user.id, ctx.company.id, invoiceId, { financialAccountId: ctx.account.id, effectiveDate: "2026-01-20", amountCents: 8_000, interestPenaltyCents: 150 });
    expect((await invoiceTitle(ctx.company.id, "2026-01")).status).toBe("PARTIALLY_SETTLED");
    const accounts = await listFinancialAccountsWithBalance(ctx.user.id, ctx.company.id);
    expect(Number(accounts.find((account) => account.id === ctx.account.id)!.currentBalanceCents)).toBe(1_000_000 - 8_150);

    await buy(ctx, { totalAmountCents: 5_000, purchaseDate: "2026-01-08" });
    const title = await invoiceTitle(ctx.company.id, "2026-01");
    expect(Number(title.originalAmountCents)).toBe(25_000);
    expect(title.status).toBe("PARTIALLY_SETTLED");

    // Tirar a compra de 20.000 deixaria a fatura em 5.000, abaixo dos 8.000 já pagos.
    await expect(cancelCreditCardPurchase(ctx.user.id, ctx.company.id, first!.id, { reason: "Devolvida" })).rejects.toBeInstanceOf(CreditCardInvoiceBelowSettledError);
  });

  it("não deixa pagar fatura ainda aberta nem futura", async () => {
    const ctx = await setup("aberta");
    const today = new Date().toISOString().slice(0, 10);
    await buy(ctx, { purchaseDate: today, totalAmountCents: 5_000 });
    await buy(ctx, { purchaseDate: today, totalAmountCents: 9_000, installmentCount: 3 });
    const detail = await getCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);
    expect(new Set(detail.invoices.map((invoice) => invoice.stage))).toEqual(new Set(["OPEN", "FUTURE"]));

    for (const invoice of detail.invoices) {
      await expect(payCreditCardInvoice(ctx.user.id, ctx.company.id, invoice.id, { financialAccountId: ctx.account.id, effectiveDate: today })).rejects.toBeInstanceOf(CreditCardInvoiceNotPayableError);
    }

    // O mesmo vale por qualquer caminho de baixa: a tela do título e a baixa em lote.
    const open = detail.invoices.find((invoice) => invoice.stage === "OPEN")!;
    await expect(registerSettlement(ctx.user.id, ctx.company.id, open.titleId, { financialAccountId: ctx.account.id, principalAmountCents: 1000, effectiveDate: today })).rejects.toBeInstanceOf(CreditCardInvoiceNotPayableError);
    await expect(applyTitleBatch(ctx.user.id, ctx.company.id, { operation: "SETTLE_FULL", titleIds: [open.titleId], financialAccountId: ctx.account.id, effectiveDate: today })).rejects.toBeInstanceOf(CreditCardInvoiceNotPayableError);
  });
});

describe("limite e resumo", () => {
  it("o limite usado conta o saldo de todas as faturas, inclusive as parcelas futuras", async () => {
    const ctx = await setup("limite");
    await buy(ctx, { totalAmountCents: 90_000, installmentCount: 3 });
    await buy(ctx, { totalAmountCents: 10_000, purchaseDate: "2026-01-08" });

    const [summary] = await listCreditCards(ctx.user.id, ctx.company.id, { today: "2026-01-12" });
    expect(Number(summary!.usedLimitCents)).toBe(100_000);
    expect(Number(summary!.availableLimitCents)).toBe(400_000);
    expect(summary!.nextPayable).toMatchObject({ referenceMonth: "2026-01", stage: "CLOSED" });
    expect(summary!.openCycle).toMatchObject({ referenceMonth: "2026-02", closingDate: "2026-02-10" });

    const paid = await getCreditCard(ctx.user.id, ctx.company.id, ctx.card.id, { today: "2026-01-12" });
    await payCreditCardInvoice(ctx.user.id, ctx.company.id, paid.invoices.find((invoice) => invoice.referenceMonth === "2026-01")!.id, { financialAccountId: ctx.account.id, effectiveDate: "2026-01-20" });
    const [after] = await listCreditCards(ctx.user.id, ctx.company.id, { today: "2026-01-12" });
    expect(Number(after!.usedLimitCents)).toBe(60_000);
  });

  it("compra acima do limite é registrada (o limite é informativo) e deixa o disponível negativo", async () => {
    const ctx = await setup("estouro");
    await buy(ctx, { totalAmountCents: 600_000 });
    const [summary] = await listCreditCards(ctx.user.id, ctx.company.id, { today: "2026-01-06" });
    expect(Number(summary!.availableLimitCents)).toBe(-100_000);
  });

  it("arquivar exige fatura quitada; reativar volta a aceitar compras; renomear atualiza o título das faturas", async () => {
    const ctx = await setup("arquivar");
    const [purchase] = await buy(ctx);
    await expect(archiveCreditCard(ctx.user.id, ctx.company.id, ctx.card.id)).rejects.toBeInstanceOf(CreditCardHasOpenInvoicesError);

    await updateCreditCard(ctx.user.id, ctx.company.id, ctx.card.id, { ...CARD, name: "Nubank Ultravioleta", closingDay: 15 });
    expect((await invoiceTitle(ctx.company.id, "2026-01")).description).toBe("Fatura Nubank Ultravioleta · 01/2026");
    // fatura já criada mantém as datas de quando nasceu
    const invoice = await rootClient.creditCardInvoice.findFirstOrThrow({ where: { companyId: ctx.company.id } });
    expect(invoice.closingDate.toISOString().slice(0, 10)).toBe("2026-01-10");

    await cancelCreditCardPurchase(ctx.user.id, ctx.company.id, purchase!.id, { reason: "Teste" });
    await archiveCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);
    await reactivateCreditCard(ctx.user.id, ctx.company.id, ctx.card.id);
    await expect(buy(ctx, { purchaseDate: "2026-02-01" })).resolves.toHaveLength(1);
  });
});

describe("integração com o resto do sistema", () => {
  it("o título da fatura não pode ser editado, cancelado, excluído, duplicado nem reclassificado à mão", async () => {
    const ctx = await setup("guardas");
    await buy(ctx, { totalAmountCents: 7_000 });
    const title = await invoiceTitle(ctx.company.id, "2026-01");
    const base = { description: "x", categoryId: ctx.category.id, originalAmountCents: 1000, competenceDate: "2026-01-10", dueDate: "2026-01-20" };

    await expect(updateTitle(ctx.user.id, ctx.company.id, title.id, base)).rejects.toBeInstanceOf(TitleManagedByCreditCardError);
    await expect(cancelTitle(ctx.user.id, ctx.company.id, title.id, { reason: "x" })).rejects.toBeInstanceOf(TitleManagedByCreditCardError);
    await expect(deleteTitle(ctx.user.id, ctx.company.id, title.id, { reason: "x" })).rejects.toBeInstanceOf(TitleManagedByCreditCardError);
    await expect(duplicateTitle(ctx.user.id, ctx.company.id, title.id)).rejects.toBeInstanceOf(TitleManagedByCreditCardError);

    const preview = await previewTitleBatch(ctx.user.id, ctx.company.id, { operation: "CANCEL", titleIds: [title.id], reason: "x" });
    expect(preview.problems).toHaveLength(1);
    await expect(applyTitleBatch(ctx.user.id, ctx.company.id, { operation: "CLASSIFY", titleIds: [title.id], categoryId: ctx.category.id })).rejects.toBeInstanceOf(TitleManagedByCreditCardError);
  });

  it("o DRE conta o gasto pelas compras (categoria e competência) e não soma de novo o título da fatura", async () => {
    const ctx = await setup("dre");
    await buy(ctx, { totalAmountCents: 30_000, purchaseDate: "2026-01-05" });
    await buy(ctx, { totalAmountCents: 9_000, installmentCount: 3, purchaseDate: "2026-01-06", description: "Eletro" });

    const january = await getManagerialIncomeStatement(ctx.user.id, ctx.company.id, { from: "2026-01-01", to: "2026-01-31" });
    expect(Number(january.totalCents)).toBe(-(30_000 + 3_000));
    const february = await getManagerialIncomeStatement(ctx.user.id, ctx.company.id, { from: "2026-02-01", to: "2026-02-28" });
    expect(Number(february.totalCents)).toBe(-3_000);

    const [purchase] = await buy(ctx, { totalAmountCents: 1_000, purchaseDate: "2026-01-07" });
    await cancelCreditCardPurchase(ctx.user.id, ctx.company.id, purchase!.id, { reason: "Cancelada" });
    const again = await getManagerialIncomeStatement(ctx.user.id, ctx.company.id, { from: "2026-01-01", to: "2026-01-31" });
    expect(Number(again.totalCents)).toBe(-(30_000 + 3_000));
  });

  it("zerar a conta apaga compras e faturas, mas mantém o cadastro do cartão", async () => {
    const ctx = await setup("reset");
    await buy(ctx, { totalAmountCents: 12_000, installmentCount: 2 });
    const result = await resetCompanyLedger(ctx.user.id, ctx.company.id, { confirmation: ctx.company.name });

    expect(result).toMatchObject({ creditCardPurchases: 2, creditCardInvoices: 2 });
    expect(await rootClient.creditCardPurchase.count({ where: { companyId: ctx.company.id } })).toBe(0);
    expect(await rootClient.creditCardInvoice.count({ where: { companyId: ctx.company.id } })).toBe(0);
    expect(await rootClient.creditCard.count({ where: { companyId: ctx.company.id } })).toBe(1);
    expect(await rootClient.title.count({ where: { companyId: ctx.company.id } })).toBe(0);
  });

  it("usuário com acesso restrito a centros de custo não opera cartão", async () => {
    const ctx = await setup("restrito");
    const operator = await registerUser({ email: uniqueEmail("operador"), name: "Operador", password: "senha-forte-456" });
    const center = await createCostCenter(ctx.user.id, ctx.company.id, { name: "Loja" });
    const { rawToken } = await createCompanyInvitation(ctx.user.id, ctx.company.id, { email: operator.email, role: "OPERATOR" });
    await acceptCompanyInvitation(operator.id, rawToken);
    const membership = (await listCompanyMembers(ctx.user.id, ctx.company.id)).find((item) => item.userId === operator.id)!;
    await updateCompanyMemberAccess(ctx.user.id, ctx.company.id, membership.id, { accessScope: "RESTRICTED", financialAccountIds: [ctx.account.id], costCenterIds: [center.id] });

    await expect(listCreditCards(operator.id, ctx.company.id)).rejects.toBeInstanceOf(CreditCardAccessRestrictedError);
    await expect(createCreditCardPurchase(operator.id, ctx.company.id, {
      cardId: ctx.card.id, description: "x", categoryId: ctx.category.id, totalAmountCents: 1000, purchaseDate: PAST_PURCHASE, costCenterId: center.id,
    })).rejects.toBeInstanceOf(CreditCardAccessRestrictedError);
  });

  it("empresas diferentes não enxergam os cartões uma da outra", async () => {
    const a = await setup("iso-a");
    const b = await setup("iso-b");
    await buy(a);
    expect(await listCreditCards(b.user.id, b.company.id)).toHaveLength(1);
    await expect(getCreditCard(b.user.id, b.company.id, a.card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    const invoice = await rootClient.creditCardInvoice.findFirstOrThrow({ where: { companyId: a.company.id } });
    await expect(getCreditCardInvoice(b.user.id, b.company.id, invoice.id)).rejects.toThrow();
  });
});
