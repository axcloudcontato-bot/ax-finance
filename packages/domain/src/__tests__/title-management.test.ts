import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createParty } from "../parties/create-party";
import { createTitle } from "../titles/create-title";
import { updateTitle } from "../titles/update-title";
import { duplicateTitle } from "../titles/duplicate-title";
import { cancelTitle } from "../titles/cancel-title";
import { listTitlesForExport, listTitlesPage } from "../titles/list-titles";
import { getPaymentMethodReport } from "../titles/payment-method-report";
import { registerSettlement } from "../titles/register-settlement";
import { suggestLateCharges } from "../titles/late-charges";
import { registerTitleCollection, setTitleScheduledPayment } from "../titles/title-operations";
import { getLateFeeSettings, updateLateFeeSettings } from "../companies/late-fee-settings";
import { listAuditEvents } from "../audit/list-audit-events";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { FinancialAccountNotFoundError, PossibleDuplicateTitleError, TitleCollectionInvalidError, TitleScheduleInvalidError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

async function setup(label: string) {
  const user = await registerUser({ email: `${label}.${randomUUID()}@teste.ax.finance`, name: `Usuária ${label}`, password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: `Empresa ${label}` });
  const account = await createFinancialAccount(user.id, company.id, { name: "Conta principal", type: "BANK", openingBalanceCents: 1_000_000, openingDate: "2026-01-01" });
  const revenue = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  const expense = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE" });
  const supplier = await createParty(user.id, company.id, { name: "Imobiliária Central", isSupplier: true });
  const client = await createParty(user.id, company.id, { name: "Cliente Alfa", isClient: true });
  return { user, company, account, revenue, expense, supplier, client };
}

type Ctx = Awaited<ReturnType<typeof setup>>;
const payable = (ctx: Ctx, extra: Record<string, unknown> = {}) =>
  createTitle(ctx.user.id, ctx.company.id, { type: "PAYABLE", description: "Aluguel do galpão", categoryId: ctx.expense.id, originalAmountCents: 250_000, competenceDate: "2026-10-01", dueDate: "2026-10-10", ...extra });
const receivable = (ctx: Ctx, extra: Record<string, unknown> = {}) =>
  createTitle(ctx.user.id, ctx.company.id, { type: "RECEIVABLE", description: "Serviço de instalação", categoryId: ctx.revenue.id, originalAmountCents: 100_000, competenceDate: "2026-10-01", dueDate: "2026-10-10", ...extra });

const page = (ctx: Ctx, type: "RECEIVABLE" | "PAYABLE", extra: Record<string, unknown> = {}) =>
  listTitlesPage(ctx.user.id, ctx.company.id, { type, from: "2026-10-01", to: "2026-10-31", today: "2026-10-15", ...extra } as never);

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await rootClient.$disconnect();
});

describe("dados operacionais do lançamento", () => {
  it("guarda conta prevista, documento, forma e código de pagamento; edição sem os campos não apaga, e vazio limpa", async () => {
    const ctx = await setup("detalhes");
    const created = await payable(ctx, { expectedAccountId: ctx.account.id, documentNumber: "NF 1234", expectedPaymentMethod: "BOLETO", paymentCode: "34191.79001 01043.510047" });
    expect(created).toMatchObject({ expectedAccountId: ctx.account.id, documentNumber: "NF 1234", expectedPaymentMethod: "BOLETO" });

    const base = { description: "Aluguel do galpão", categoryId: ctx.expense.id, originalAmountCents: 250_000, competenceDate: "2026-10-01", dueDate: "2026-10-10" };
    const untouched = await updateTitle(ctx.user.id, ctx.company.id, created.id, { ...base, notes: "obs" });
    expect(untouched).toMatchObject({ expectedAccountId: ctx.account.id, documentNumber: "NF 1234", paymentCode: "34191.79001 01043.510047" });

    const cleared = await updateTitle(ctx.user.id, ctx.company.id, created.id, { ...base, documentNumber: null, expectedAccountId: null });
    expect(cleared).toMatchObject({ expectedAccountId: null, documentNumber: null, expectedPaymentMethod: "BOLETO" });
  });

  it("recusa conta prevista de outra empresa e a duplicação mantém conta e forma, sem documento", async () => {
    const ctx = await setup("conta");
    const other = await setup("outra");
    await expect(payable(ctx, { expectedAccountId: other.account.id })).rejects.toBeInstanceOf(FinancialAccountNotFoundError);

    const original = await payable(ctx, { expectedAccountId: ctx.account.id, expectedPaymentMethod: "PIX", documentNumber: "NF 9" });
    const copy = await duplicateTitle(ctx.user.id, ctx.company.id, original.id);
    expect(copy).toMatchObject({ expectedAccountId: ctx.account.id, expectedPaymentMethod: "PIX", documentNumber: null });
  });
});

describe("aviso de duplicidade", () => {
  it("só avisa quando pedido: mesmo valor, vencimento próximo e mesma pessoa ou descrição", async () => {
    const ctx = await setup("duplicidade");
    await payable(ctx, { partyId: ctx.supplier.id });

    // Sem o aviso ligado, lança normalmente (lote e recorrência não são interrompidos).
    await expect(payable(ctx, { partyId: ctx.supplier.id })).resolves.toBeDefined();

    await expect(payable(ctx, { partyId: ctx.supplier.id, dueDate: "2026-10-14", checkDuplicates: true })).rejects.toBeInstanceOf(PossibleDuplicateTitleError);
    // Outro valor, vencimento fora da janela de 7 dias ou outra pessoa não são duplicidade.
    await expect(payable(ctx, { partyId: ctx.supplier.id, originalAmountCents: 250_100, checkDuplicates: true })).resolves.toBeDefined();
    await expect(payable(ctx, { partyId: ctx.supplier.id, dueDate: "2026-12-10", checkDuplicates: true })).resolves.toBeDefined();
    await expect(payable(ctx, { partyId: ctx.client.id, checkDuplicates: true })).resolves.toBeDefined();
  });

  it("sem pessoa compara pela descrição (sem diferenciar maiúsculas) e ignora cancelados", async () => {
    const ctx = await setup("descricao");
    const first = await payable(ctx);
    await expect(payable(ctx, { description: "ALUGUEL DO GALPÃO", checkDuplicates: true })).rejects.toBeInstanceOf(PossibleDuplicateTitleError);

    await cancelTitle(ctx.user.id, ctx.company.id, first.id, { reason: "lançado errado" });
    await expect(payable(ctx, { description: "Aluguel do galpão", checkDuplicates: true })).resolves.toBeDefined();
  });
});

describe("lista com busca, filtros e ordenação", () => {
  it("busca por descrição, documento e nome da pessoa; filtra por categoria, pessoa e faixa de valor", async () => {
    const ctx = await setup("filtros");
    await payable(ctx, { description: "Aluguel", partyId: ctx.supplier.id, documentNumber: "NF-777", originalAmountCents: 250_000 });
    await payable(ctx, { description: "Energia", originalAmountCents: 40_000, dueDate: "2026-10-12" });
    await payable(ctx, { description: "Internet", originalAmountCents: 15_000, dueDate: "2026-10-20" });

    expect((await page(ctx, "PAYABLE", { search: "energ" })).titles.map((row) => row.description)).toEqual(["Energia"]);
    expect((await page(ctx, "PAYABLE", { search: "nf-777" })).total).toBe(1);
    expect((await page(ctx, "PAYABLE", { search: "imobiliária" })).titles.map((row) => row.description)).toEqual(["Aluguel"]);
    expect((await page(ctx, "PAYABLE", { partyId: ctx.supplier.id })).total).toBe(1);
    expect((await page(ctx, "PAYABLE", { minCents: 20_000n, maxCents: 100_000n })).titles.map((row) => row.description)).toEqual(["Energia"]);
    expect((await page(ctx, "PAYABLE", { categoryId: ctx.revenue.id })).total).toBe(0);
    // O resumo acompanha o filtro, não só a página.
    expect((await page(ctx, "PAYABLE", { search: "energ" })).summary.openCents).toBe(40_000n);
  });

  it("ordena por valor e por pessoa, nos dois sentidos", async () => {
    const ctx = await setup("ordem");
    await payable(ctx, { description: "Médio", originalAmountCents: 40_000, partyId: ctx.supplier.id });
    await payable(ctx, { description: "Grande", originalAmountCents: 90_000 });
    await payable(ctx, { description: "Pequeno", originalAmountCents: 10_000, partyId: ctx.client.id });

    expect((await page(ctx, "PAYABLE", { sort: "valor", dir: "desc" })).titles.map((row) => row.description)).toEqual(["Grande", "Médio", "Pequeno"]);
    expect((await page(ctx, "PAYABLE", { sort: "valor", dir: "asc" })).titles.map((row) => row.description)).toEqual(["Pequeno", "Médio", "Grande"]);
    expect((await page(ctx, "PAYABLE", { sort: "pessoa", dir: "asc" })).titles[0]!.description).toBe("Pequeno"); // "Cliente Alfa" antes de "Imobiliária Central"
  });

  it("a exportação respeita os mesmos filtros e traz o saldo aberto", async () => {
    const ctx = await setup("exportar");
    await receivable(ctx, { description: "Alfa", partyId: ctx.client.id, expectedAccountId: ctx.account.id });
    await receivable(ctx, { description: "Beta" });

    const exported = await listTitlesForExport(ctx.user.id, ctx.company.id, { type: "RECEIVABLE", from: "2026-10-01", to: "2026-10-31", today: "2026-10-15", search: "alfa" });
    expect(exported.truncated).toBe(false);
    expect(exported.titles).toHaveLength(1);
    expect(exported.titles[0]).toMatchObject({ description: "Alfa", remainingCents: 100_000n, party: { name: "Cliente Alfa" }, expectedAccount: { name: "Conta principal" } });
  });
});

describe("agendamento de pagamento e cobrança", () => {
  it("agenda e remove o agendamento de uma saída em aberto, com auditoria; recebível não agenda", async () => {
    const ctx = await setup("agenda");
    const out = await payable(ctx);
    const scheduled = await setTitleScheduledPayment(ctx.user.id, ctx.company.id, out.id, "2026-10-09");
    expect(scheduled.scheduledPaymentDate?.toISOString().slice(0, 10)).toBe("2026-10-09");
    expect((await setTitleScheduledPayment(ctx.user.id, ctx.company.id, out.id, null)).scheduledPaymentDate).toBeNull();

    const events = await listAuditEvents(ctx.user.id, ctx.company.id, { resourceType: "Title", resourceId: out.id });
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(["TITLE_PAYMENT_SCHEDULED", "TITLE_PAYMENT_SCHEDULE_REMOVED"]));

    const incoming = await receivable(ctx);
    await expect(setTitleScheduledPayment(ctx.user.id, ctx.company.id, incoming.id, "2026-10-09")).rejects.toBeInstanceOf(TitleScheduleInvalidError);
  });

  it("registra a cobrança do recebível, conta as tentativas e recusa saída", async () => {
    const ctx = await setup("cobranca");
    const incoming = await receivable(ctx);
    await registerTitleCollection(ctx.user.id, ctx.company.id, incoming.id);
    const second = await registerTitleCollection(ctx.user.id, ctx.company.id, incoming.id);
    expect(second.collectionCount).toBe(2);
    expect(second.lastCollectionAt).toBeInstanceOf(Date);

    const out = await payable(ctx);
    await expect(registerTitleCollection(ctx.user.id, ctx.company.id, out.id)).rejects.toBeInstanceOf(TitleCollectionInvalidError);
  });
});

describe("multa e juros de atraso", () => {
  it("sugere multa de uma vez e juros ao mês proporcionais aos dias de atraso", () => {
    const base = { remainingCents: 100_000n, dueDate: "2026-10-01", lateFeeBps: 200, lateInterestMonthlyBps: 100 };
    // 15 dias: multa 2% = 20,00; juros 1% ao mês × 15/30 = 5,00.
    expect(suggestLateCharges({ ...base, effectiveDate: "2026-10-16" })).toEqual({ days: 15, feeCents: 2_000n, interestCents: 500n, totalCents: 2_500n });
    // Em dia, antes do vencimento ou sem percentuais: nada.
    expect(suggestLateCharges({ ...base, effectiveDate: "2026-10-01" }).totalCents).toBe(0n);
    expect(suggestLateCharges({ ...base, effectiveDate: "2026-09-20" }).totalCents).toBe(0n);
    expect(suggestLateCharges({ ...base, effectiveDate: "2026-10-20", lateFeeBps: 0, lateInterestMonthlyBps: 0 }).totalCents).toBe(0n);
  });

  it("guarda os percentuais da empresa, valida o limite e registra na auditoria", async () => {
    const ctx = await setup("multa");
    expect(await getLateFeeSettings(ctx.user.id, ctx.company.id)).toEqual({ lateFeeBps: 0, lateInterestMonthlyBps: 0 });
    await updateLateFeeSettings(ctx.user.id, ctx.company.id, { lateFeeBps: 200, lateInterestMonthlyBps: 100 });
    expect(await getLateFeeSettings(ctx.user.id, ctx.company.id)).toEqual({ lateFeeBps: 200, lateInterestMonthlyBps: 100 });
    await expect(updateLateFeeSettings(ctx.user.id, ctx.company.id, { lateFeeBps: 5_000, lateInterestMonthlyBps: 0 })).rejects.toThrow();
    const events = await listAuditEvents(ctx.user.id, ctx.company.id, { resourceType: "Company", resourceId: ctx.company.id });
    expect(events.map((event) => event.eventType)).toContain("LATE_FEE_SETTINGS_UPDATED");
  });
});

describe("projeção do dashboard por conta", () => {
  it("com uma conta escolhida, só os títulos com essa conta prevista entram, e os sem conta são contados à parte", async () => {
    const ctx = await setup("por-conta");
    const second = await createFinancialAccount(ctx.user.id, ctx.company.id, { name: "Poupança", type: "BANK", openingBalanceCents: 0, openingDate: "2026-01-01" });
    await payable(ctx, { description: "Na principal", expectedAccountId: ctx.account.id, dueDate: "2026-10-20" });
    await payable(ctx, { description: "Na poupança", expectedAccountId: second.id, dueDate: "2026-10-21" });
    await payable(ctx, { description: "Sem conta", dueDate: "2026-10-22" });
    const base = { from: "2026-10-01", to: "2026-10-31", today: "2026-10-15" };

    const all = await getDashboardOverview(ctx.user.id, ctx.company.id, base);
    expect(all.projectionTitles).toHaveLength(3);
    expect(all.unassignedOpen).toBeNull();

    const principal = await getDashboardOverview(ctx.user.id, ctx.company.id, { ...base, financialAccountId: ctx.account.id });
    expect(principal.projectionTitles.map((title) => title.description)).toEqual(["Na principal"]);
    expect(principal.unassignedOpen).toBe(1);
    // Saldo da própria conta: R$ 10.000,00 menos o título previsto nela.
    expect(principal.availableBalanceCents).toBe(1_000_000n);
    expect(principal.projectedBalanceCents).toBe(750_000n);
  });
});

describe("relatório por forma de pagamento", () => {
  it("separa o realizado (meio da baixa) do previsto (forma do lançamento) e mostra o que falta classificar", async () => {
    const ctx = await setup("forma");
    const pix = await receivable(ctx, { originalAmountCents: 100_000, expectedPaymentMethod: "PIX" });
    const boleto = await payable(ctx, { originalAmountCents: 30_000, expectedPaymentMethod: "BOLETO", dueDate: "2026-10-12" });
    await payable(ctx, { originalAmountCents: 12_000, dueDate: "2026-10-13" }); // sem forma prevista
    await receivable(ctx, { originalAmountCents: 20_000, expectedPaymentMethod: "PIX", dueDate: "2026-10-14" }); // previsto
    await registerSettlement(ctx.user.id, ctx.company.id, pix.id, { financialAccountId: ctx.account.id, principalAmountCents: 100_000, effectiveDate: "2026-10-10", paymentMethod: "pix" });
    await registerSettlement(ctx.user.id, ctx.company.id, boleto.id, { financialAccountId: ctx.account.id, principalAmountCents: 30_000, effectiveDate: "2026-10-12", paymentMethod: "Cheque especial" });

    const report = await getPaymentMethodReport(ctx.user.id, ctx.company.id, { from: "2026-10-01", to: "2026-10-31" });
    const by = Object.fromEntries(report.rows.map((row) => [row.key, row]));

    // "pix" (minúsculo) é reconhecido como PIX; "Cheque especial" não é uma forma conhecida e vira texto livre.
    expect(by.PIX).toMatchObject({ receivedCents: 100_000n, settlementCount: 1, openReceivableCents: 20_000n });
    expect(by.TEXTO_LIVRE).toMatchObject({ paidCents: 30_000n });
    expect(by.NAO_INFORMADO).toMatchObject({ openPayableCents: 12_000n, openCount: 1 });
    expect(report.totals).toMatchObject({ receivedCents: 100_000n, paidCents: 30_000n, openReceivableCents: 20_000n, openPayableCents: 12_000n });
  });
});
