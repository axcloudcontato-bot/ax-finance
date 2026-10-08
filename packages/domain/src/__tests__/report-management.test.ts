import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createBalanceAdjustment } from "../financial-accounts/create-balance-adjustment";
import { createCategory } from "../categories/create-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { registerSettlementRefund } from "../titles/settlement-refunds";
import { createTransfer } from "../transfers/create-transfer";
import { createCreditCard, createCreditCardPurchase } from "../credit-cards";
import { getCashFlowReport } from "../reports/cash-flow-report";
import { getCashProjection } from "../reports/cash-projection";
import { getOpenTitlesAgingReport } from "../reports/aging-report";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { addReportDays } from "../reports/report-period";
import { getCompanyToday } from "../shared/today";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(resetDatabase);
afterAll(() => rootClient.$disconnect());
async function setup(balance = 10000) {
  const user = await registerUser({ email: `${randomUUID()}@reports.example.test`, name: "Auditoria de relatórios", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Relatórios fictícios" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: balance, openingDate: "2020-01-01" });
  const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE", managerialGroup: "Mesmo grupo" });
  const expense = await createCategory(user.id, company.id, { name: "Despesas", nature: "EXPENSE", managerialGroup: "Mesmo grupo" });
  return { user, company, account, revenue, expense };
}
type Context = Awaited<ReturnType<typeof setup>>;
function title(c: Context, type: "RECEIVABLE" | "PAYABLE", amount: number, date: string, categoryId?: string) {
  return createTitle(c.user.id, c.company.id, { type, description: `Teste ${type}`, categoryId: categoryId ?? (type === "RECEIVABLE" ? c.revenue.id : c.expense.id), originalAmountCents: amount, competenceDate: date, dueDate: date });
}
function settle(c: Context, id: string, amount: number, date: string, extra = {}) {
  return registerSettlement(c.user.id, c.company.id, id, { financialAccountId: c.account.id, principalAmountCents: amount, effectiveDate: date, ...extra });
}
const JANUARY = { from: "2026-01-01", to: "2026-01-31" };

it("reconcilia saldo inicial, baixas, abertura no período, tarifa e ajuste sem tratar transferência como receita", async () => {
  const c = await setup(50000);
  const other = await createFinancialAccount(c.user.id, c.company.id, { name: "Nova conta", type: "BANK", openingBalanceCents: 10000, openingDate: "2026-01-10" });
  const sale = await title(c, "RECEIVABLE", 10000, "2026-01-05");
  await settle(c, sale.id, 10000, "2026-01-05", { feesCents: 100 });
  await createTransfer(c.user.id, c.company.id, { fromAccountId: c.account.id, toAccountId: other.id, amountCents: 5000, feeCents: 200, transferDate: "2026-01-15" });
  await createBalanceAdjustment(c.user.id, c.company.id, { financialAccountId: c.account.id, targetBalanceCents: 55700, effectiveDate: "2026-01-20", reason: "Ajuste fictício de +1000" });
  const r = await getCashFlowReport(c.user.id, c.company.id, JANUARY);
  expect(r.openingBalanceCents).toBe(50000n);
  expect(r.totalCents).toBe(9900n);
  expect(r.otherBalanceChangesCents).toBe(10800n);
  expect(r.closingBalanceCents).toBe(70700n);
  expect(r.balanceDifferenceCents).toBe(0n);
});

it("dá identidade própria a cada devolução e conserva sua direção de caixa", async () => {
  const c = await setup();
  const sale = await title(c, "RECEIVABLE", 10000, "2026-01-05");
  const s = await settle(c, sale.id, 10000, "2026-01-05");
  for (const amount of [1000, 2000]) await registerSettlementRefund(c.user.id, c.company.id, s.id, { financialAccountId: c.account.id, amountCents: amount, effectiveDate: "2026-01-10", reason: "Devolução fictícia" });
  const r = await getCashFlowReport(c.user.id, c.company.id, JANUARY);
  expect(r.entries).toHaveLength(3);
  expect(new Set(r.entries.map((e) => e.id)).size).toBe(3);
  expect(r.entries.filter((e) => e.kind === "REFUND").map((e) => e.cashDeltaCents)).toEqual([-1000n, -2000n]);
  expect(r.totalCents).toBe(7000n);
  expect(r.entries.every((e) => e.titleId === sale.id && e.accountName === "Banco")).toBe(true);
});

it("baixa com data futura não vira realizado nem elimina obrigação da projeção ou do aging atual", async () => {
  const c = await setup();
  const today = await getCompanyToday(c.user.id, c.company.id);
  const future = addReportDays(today, 10);
  const bill = await title(c, "PAYABLE", 20000, future);
  await settle(c, bill.id, 20000, future);
  const cash = await getCashFlowReport(c.user.id, c.company.id, { from: today, to: future });
  expect(cash.totalCents).toBe(0n);
  expect(cash.closingBalanceCents).toBe(10000n);
  const projection = await getCashProjection(c.user.id, c.company.id, { days: 30 });
  expect(projection.paymentsCents).toBe(20000n);
  const aging = await getOpenTitlesAgingReport(c.user.id, c.company.id, {});
  expect(aging.entries[0]?.remainingCents).toBe(20000n);
});

it("identifica falta temporária de caixa mesmo com saldo positivo ao final", async () => {
  const c = await setup();
  await title(c, "PAYABLE", 20000, "2026-10-09");
  await title(c, "RECEIVABLE", 30000, "2026-10-10");
  const p = await getCashProjection(c.user.id, c.company.id, { today: "2026-10-08", days: 30 });
  expect(p.cautiousBalanceCents).toBe(20000n);
  expect(p.minimumCents).toBe(-10000n);
  expect(p.cashNeededCents).toBe(10000n);
  expect(p.firstNegativeDate).toBe("2026-10-09");
});

it("não financia obrigações vencidas com recebíveis vencidos no cenário cauteloso", async () => {
  const c = await setup();
  await title(c, "RECEIVABLE", 20000, "2026-10-01");
  await title(c, "PAYABLE", 20000, "2026-10-01");
  const p = await getCashProjection(c.user.id, c.company.id, { today: "2026-10-08" });
  expect(p.projectedBalanceCents).toBe(10000n);
  expect(p.cautiousBalanceCents).toBe(-10000n);
  expect(p.firstNegativeDate).toBe("2026-10-08");
});

it("inclui cartão aberto e parcelas futuras uma vez, nos vencimentos de cada fatura", async () => {
  const c = await setup(200000);
  const card = await createCreditCard(c.user.id, c.company.id, { name: "Cartão fictício", limitCents: 500000, closingDay: 10, dueDay: 20 });
  await createCreditCardPurchase(c.user.id, c.company.id, { cardId: card.id, description: "Compra parcelada", categoryId: c.expense.id, totalAmountCents: 120000, purchaseDate: "2026-10-05", installmentCount: 3 });
  const short = await getCashProjection(c.user.id, c.company.id, { today: "2026-10-08", days: 30 });
  const long = await getCashProjection(c.user.id, c.company.id, { today: "2026-10-08", days: 90 });
  expect(short.paymentsCents).toBe(40000n);
  expect(long.paymentsCents).toBe(120000n);
  expect(long.items).toHaveLength(3);
  expect(long.items.every((e) => e.isCardInvoice)).toBe(true);
});

it("limita horizonte inclusivo e exclui contas fora do disponível e aberturas futuras", async () => {
  const c = await setup();
  await createFinancialAccount(c.user.id, c.company.id, { name: "Reserva", type: "BANK", openingBalanceCents: 90000, openingDate: "2020-01-01", includedInAvailableTotal: false });
  await createFinancialAccount(c.user.id, c.company.id, { name: "Futura", type: "BANK", openingBalanceCents: 90000, openingDate: "2027-01-01" });
  await title(c, "PAYABLE", 1000, "2026-11-06");
  await title(c, "PAYABLE", 2000, "2026-11-07");
  const p = await getCashProjection(c.user.id, c.company.id, { today: "2026-10-08", days: 30 });
  expect(p.series).toHaveLength(30);
  expect(p.through).toBe("2026-11-06");
  expect(p.availableBalanceCents).toBe(10000n);
  expect(p.paymentsCents).toBe(1000n);
});

it("faixas respeitam fronteiras e o filtro da lista não muda o total da carteira", async () => {
  const c = await setup();
  const reference = "2026-05-31";
  for (const days of [0, 1, 7, 8, 15, 16, 30, 31, 60, 61]) await title(c, "RECEIVABLE", 1000, addReportDays(reference, -days));
  const r = await getOpenTitlesAgingReport(c.user.id, c.company.id, { asOfDate: reference, bucket: "D8_15" });
  expect(r.allEntries.map((e) => e.bucket)).toEqual(["D60_PLUS", "D31_60", "D31_60", "D16_30", "D16_30", "D8_15", "D8_15", "D1_7", "D1_7", "A_VENCER"]);
  expect(r.entries).toHaveLength(2);
  expect(r.selectedTotalCents).toBe(2000n);
  expect(r.totalCents).toBe(10000n);
});

it("data de atraso não promete posição histórica e principal não é reduzido por juros ou taxas", async () => {
  const c = await setup();
  const sale = await title(c, "RECEIVABLE", 10000, "2026-01-10");
  await settle(c, sale.id, 4000, "2026-02-10", { discountCents: 1000, interestPenaltyCents: 500, feesCents: 200 });
  const r = await getOpenTitlesAgingReport(c.user.id, c.company.id, { asOfDate: "2026-01-20" });
  expect(r.entries[0]?.remainingCents).toBe(5000n);
  expect(r.entries[0]?.daysLate).toBe(10);
  expect(r.balanceAsOfDate.toISOString().slice(0, 10)).toBe(await getCompanyToday(c.user.id, c.company.id));
});

it("agenda exclui vencidos e separa hoje, sete e trinta dias com limites inclusivos", async () => {
  const c = await setup();
  for (const delta of [-1, 0, 7, 8, 30, 31]) await title(c, "PAYABLE", 1000, addReportDays("2026-10-08", delta));
  const r = await getOpenTitlesAgingReport(c.user.id, c.company.id, { asOfDate: "2026-10-08" });
  expect(r.schedule.map((row) => row.payableCents)).toEqual([1000n, 2000n, 4000n]);
});

it("DRE separa naturezas com grupos iguais e calcula receitas, custos e despesas sem perder detalhamento", async () => {
  const c = await setup();
  const cost = await createCategory(c.user.id, c.company.id, { name: "Materiais", nature: "COST", managerialGroup: "Mesmo grupo" });
  await title(c, "RECEIVABLE", 50000, "2026-01-05");
  await title(c, "PAYABLE", 10000, "2026-01-05", cost.id);
  await title(c, "PAYABLE", 20000, "2026-01-05");
  const r = await getManagerialIncomeStatement(c.user.id, c.company.id, JANUARY);
  expect(r.revenueCents).toBe(50000n);
  expect(r.costCents).toBe(-10000n);
  expect(r.grossResultCents).toBe(40000n);
  expect(r.operatingResultCents).toBe(20000n);
  expect(r.natureGroups).toHaveLength(3);
  expect(r.categoryDetails).toHaveLength(3);
  expect(r.ungroupedCategoryCount).toBe(0);
});

it("DRE alerta sobre sinal atípico e devolução sem inventar ajuste de resultado", async () => {
  const c = await setup();
  const atypical = await title(c, "PAYABLE", 10000, "2026-01-05", c.revenue.id);
  const s = await settle(c, atypical.id, 10000, "2026-01-05");
  await registerSettlementRefund(c.user.id, c.company.id, s.id, { financialAccountId: c.account.id, amountCents: 1000, effectiveDate: "2026-01-10", reason: "Devolução fictícia" });
  const r = await getManagerialIncomeStatement(c.user.id, c.company.id, JANUARY);
  expect(r.unusualSignCount).toBe(1);
  expect(r.unclassifiedRefundCents).toBe(1000n);
  expect(r.totalCents).toBe(-10000n);
});

it("recusa datas inexistentes e períodos invertidos antes de consultar registros", async () => {
  const c = await setup();
  for (const report of [getCashFlowReport, getManagerialIncomeStatement]) {
    await expect(report(c.user.id, c.company.id, { from: "2026-02-31", to: "2026-03-01" })).rejects.toThrow();
    await expect(report(c.user.id, c.company.id, { from: "2026-03-01", to: "2026-02-01" })).rejects.toThrow();
  }
  await expect(getOpenTitlesAgingReport(c.user.id, c.company.id, { asOfDate: "2026-02-31" })).rejects.toThrow();
});

it("projeção e detalhes da DRE mantêm isolamento entre empresas", async () => {
  const owner = await setup();
  const outsider = await setup(0);
  await title(owner, "PAYABLE", 50000, "2026-01-05");
  expect((await getCashProjection(outsider.user.id, outsider.company.id, { today: "2026-01-01" })).items).toHaveLength(0);
  expect((await getManagerialIncomeStatement(outsider.user.id, outsider.company.id, JANUARY)).categoryDetails).toHaveLength(0);
});
