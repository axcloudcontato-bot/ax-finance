import { randomUUID } from "node:crypto";
import { withCompanyContext } from "@ax-finance/db";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { createCreditCard, createCreditCardPurchase, getCreditCard, getCreditCardInvoice, listCreditCards, payCreditCardInvoice } from "../credit-cards";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { updateCategory } from "../categories/update-category";
import { closePeriod } from "../closures/close-period";
import { reopenPeriod } from "../closures/reopen-period";
import { createTitle } from "../titles/create-title";
import { duplicateTitle } from "../titles/duplicate-title";
import { createRecurrenceRule } from "../recurrences/create-recurrence-rule";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";
import { cancelRecurrenceRule } from "../recurrences/cancel-recurrence-rule";
import { updateTitle } from "../titles/update-title";
import { cancelTitle } from "../titles/cancel-title";
import { deleteTitle } from "../titles/delete-title";
import { deleteInstallmentPlan } from "../titles/delete-installment-plan";
import { createInstallmentPlan } from "../titles/create-installment-plan";
import { applyTitleBatch } from "../titles/title-batch";
import { clearTitleAllocations, replaceTitleAllocations } from "../titles/title-allocations";
import { registerSettlement } from "../titles/register-settlement";
import { reverseSettlement } from "../titles/reverse-settlement";
import { registerSettlementRefund } from "../titles/settlement-refunds";
import { createDebt, deleteDebt, getDebt, getNetWorth, setDebtArchived } from "../wealth/wealth";
import { amortizationSchedule } from "../wealth/amortization";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { getDashboardInsights } from "../reports/dashboard-insights";
import { getDashboardOverview } from "../reports/dashboard-overview";
import { getCashProjection } from "../reports/cash-projection";
import { getFinancialCalendar } from "../reports/financial-calendar";
import { getMonthlyReportData } from "../reports/monthly-report";
import { getCashFlowReport } from "../reports/cash-flow-report";
import { addReportDays } from "../reports/report-period";
import { todayInTimeZone } from "../shared/today";
import { DebtInstallmentManagedError, IdempotencyConflictError, PeriodClosedError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

const today = todayInTimeZone();
beforeEach(resetDatabase);
afterAll(async () => rootClient.$disconnect());

async function setup() {
  const user = await registerUser({ email: `integridade.${randomUUID()}@teste.ax.finance`, name: "Gestão", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Empresa Integridade" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 100_000, openingDate: "2026-01-01" });
  const category = await createCategory(user.id, company.id, { name: "Despesas", nature: "EXPENSE" });
  const revenue = await createCategory(user.id, company.id, { name: "Vendas", nature: "OPERATING_REVENUE" });
  return { user, company, account, category, revenue };
}

describe("integridade financeira entre módulos", () => {
  it("fechar aguarda a escrita em andamento sem impedir outra verificação de período", async () => {
    const { user, company } = await setup();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    const writing = withCompanyContext(user.id, company.id, async (tx) => {
      await assertPeriodOpen(tx, company.id, new Date("2026-09-01"));
      entered();
      await gate;
    });
    await ready;
    let completed = false;
    const closing = closePeriod(user.id, company.id, { period: "2026-09" }).then((result) => { completed = true; return result; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(completed).toBe(false);
      await withCompanyContext(user.id, company.id, (tx) => assertPeriodOpen(tx, company.id, new Date("2026-09-01")));
    } finally {
      release();
      await writing;
    }
    await expect(closing).resolves.toMatchObject({ status: "CLOSED" });
    await expect(withCompanyContext(user.id, company.id, (tx) => assertPeriodOpen(tx, company.id, new Date("2026-09-01")))).rejects.toBeInstanceOf(PeriodClosedError);
  });
  it("fecha a competência para criação, edição, cancelamento, rateio, lote e mudança de natureza", async () => {
    const { user, company, category, revenue } = await setup();
    const input = { type: "PAYABLE", description: "Despesa", categoryId: category.id, originalAmountCents: 10_000, competenceDate: "2026-09-01", dueDate: "2026-10-01" };
    const old = await createTitle(user.id, company.id, input);
    const current = await createTitle(user.id, company.id, { ...input, competenceDate: "2026-10-01" });
    const allocations = { allocations: [{ categoryId: category.id, amountCents: 5000 }, { categoryId: revenue.id, amountCents: 5000 }] };
    await replaceTitleAllocations(user.id, company.id, old.id, allocations);
    await closePeriod(user.id, company.id, { period: "2026-09" });
    await expect(createTitle(user.id, company.id, input)).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(duplicateTitle(user.id, company.id, old.id)).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(updateTitle(user.id, company.id, old.id, { ...input, competenceDate: "2026-10-01" })).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(updateTitle(user.id, company.id, current.id, input)).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(cancelTitle(user.id, company.id, old.id, { reason: "Correção" })).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(replaceTitleAllocations(user.id, company.id, old.id, allocations)).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(clearTitleAllocations(user.id, company.id, old.id)).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(applyTitleBatch(user.id, company.id, { operation: "CANCEL", titleIds: [current.id, old.id], reason: "Correção" })).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(applyTitleBatch(user.id, company.id, { operation: "CLASSIFY", titleIds: [old.id], categoryId: revenue.id })).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(updateCategory(user.id, company.id, category.id, { name: "Despesas", nature: "COST" })).rejects.toBeInstanceOf(PeriodClosedError);
    await expect(createInstallmentPlan(user.id, company.id, { type: "PAYABLE", description: "Plano", categoryId: category.id, totalAmountCents: 2000, installmentCount: 2, firstDueDate: "2026-08-01" })).rejects.toBeInstanceOf(PeriodClosedError);
    expect((await rootClient.title.findUniqueOrThrow({ where: { id: current.id } })).status).toBe("OPEN");
    expect(await rootClient.title.count({ where: { companyId: company.id } })).toBe(2);
    await reopenPeriod(user.id, company.id, { period: "2026-09", reason: "Ajuste autorizado" });
    await expect(cancelTitle(user.id, company.id, old.id, { reason: "Correção" })).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("recorrências preservam títulos fechados e só materializam ocorrências em meses abertos", async () => {
    const { user, company, category } = await setup();
    const rule = await createRecurrenceRule(user.id, company.id, { type: "PAYABLE", description: "Recorrente", categoryId: category.id, amountCents: 5000, dayOfMonth: 1, startDate: "2026-08-01" });
    await generateDueOccurrences(user.id, company.id);
    await closePeriod(user.id, company.id, { period: "2026-09" });
    await cancelRecurrenceRule(user.id, company.id, rule.id, { reason: "Encerrar", alsoCancelOpenTitles: true });
    const titles = await rootClient.title.findMany({ where: { recurrenceRuleId: rule.id } });
    expect(titles.find((title) => title.competenceDate.toISOString().slice(0, 7) === "2026-09")?.status).toBe("OPEN");
    expect(titles.filter((title) => title.competenceDate.toISOString().slice(0, 7) !== "2026-09").every((title) => title.status === "CANCELLED")).toBe(true);
    const second = await createRecurrenceRule(user.id, company.id, { type: "PAYABLE", description: "Nova recorrência", categoryId: category.id, amountCents: 6000, dayOfMonth: 1, startDate: "2026-08-01" });
    await generateDueOccurrences(user.id, company.id);
    expect(await rootClient.title.count({ where: { recurrenceRuleId: second.id, competenceDate: { gte: new Date("2026-09-01"), lte: new Date("2026-09-30") } } })).toBe(0);
    expect(await rootClient.title.count({ where: { recurrenceRuleId: second.id } })).toBeGreaterThan(0);
  });

  it("cadastra dívidas sem duplicação e desfaz todo o contrato se uma parcela alcançar mês fechado", async () => {
    const { user, company, category } = await setup();
    const input = { name: "Contrato", principalCents: 100_000, monthlyRateBps: 1000, installmentCount: 3, firstDueDate: "2026-08-01", categoryId: category.id, idempotencyKey: randomUUID() };
    await closePeriod(user.id, company.id, { period: "2026-09" });
    await expect(createDebt(user.id, company.id, input)).rejects.toBeInstanceOf(PeriodClosedError);
    expect(await rootClient.debt.count({ where: { companyId: company.id } })).toBe(0);
    expect(await rootClient.title.count({ where: { companyId: company.id } })).toBe(0);
    await reopenPeriod(user.id, company.id, { period: "2026-09", reason: "Cadastrar contrato" });
    const [first, replay] = await Promise.all([createDebt(user.id, company.id, input), createDebt(user.id, company.id, input)]);
    expect(replay.id).toBe(first.id);
    expect(await rootClient.title.count({ where: { companyId: company.id } })).toBe(3);
    await expect(createDebt(user.id, company.id, { ...input, principalCents: 200_000 })).rejects.toBeInstanceOf(IdempotencyConflictError);
    await closePeriod(user.id, company.id, { period: "2026-09" });
    await expect(deleteDebt(user.id, company.id, first.id)).rejects.toBeInstanceOf(PeriodClosedError);
    expect(await rootClient.title.count({ where: { companyId: company.id, deletedAt: null } })).toBe(3);
  });

  it("amortiza a parcela realmente paga, inclusive parcialmente, ignora futuro e recompõe no estorno", async () => {
    const { user, company, account, category } = await setup();
    const debt = await createDebt(user.id, company.id, { name: "Price", principalCents: 100_000, monthlyRateBps: 1000, installmentCount: 3, firstDueDate: today, categoryId: category.id });
    const schedule = amortizationSchedule({ principalCents: 100_000n, monthlyRateBps: 1000, count: 3, system: "PRICE" });
    const titles = await rootClient.title.findMany({ where: { installmentGroupId: debt.installmentGroupId }, orderBy: { installmentNumber: "asc" } });
    await registerSettlement(user.id, company.id, titles[2]!.id, { financialAccountId: account.id, principalAmountCents: Number(schedule[2]!.paymentCents), effectiveDate: today });
    let view = await getDebt(user.id, company.id, debt.id);
    expect(view.balanceCents).toBe(63_443n);
    expect(view.rows[0]!.state).toBe("OPEN");
    expect(view.rows[2]!.state).toBe("PAID");
    const partial = await registerSettlement(user.id, company.id, titles[0]!.id, { financialAccountId: account.id, principalAmountCents: 20_000, discountCents: 1000, interestPenaltyCents: 500, feesCents: 300, effectiveDate: today });
    view = await getDebt(user.id, company.id, debt.id);
    const amortized = (schedule[0]!.amortizationCents * 21_000n + schedule[0]!.paymentCents / 2n) / schedule[0]!.paymentCents;
    expect(view.balanceCents).toBe(63_443n - amortized);
    expect(view.nextInstallment?.amountCents).toBe(schedule[0]!.paymentCents - 21_000n);
    expect(view.remainingPaymentsCents).toBe(view.balanceCents + view.remainingInterestCents);
    await registerSettlement(user.id, company.id, titles[1]!.id, { financialAccountId: account.id, principalAmountCents: Number(schedule[1]!.paymentCents), effectiveDate: addReportDays(today, 10) });
    expect((await getDebt(user.id, company.id, debt.id)).balanceCents).toBe(view.balanceCents);
    await reverseSettlement(user.id, company.id, partial.id, { reason: "Correção" });
    expect((await getDebt(user.id, company.id, debt.id)).balanceCents).toBe(63_443n);
    const before = await getNetWorth(user.id, company.id);
    await setDebtArchived(user.id, company.id, debt.id, true);
    const after = await getNetWorth(user.id, company.id);
    expect(after.debtsCents).toBe(before.debtsCents);
    expect(after.netWorthCents).toBe(before.netWorthCents);
    expect(after.debts[0]?.archived).toBe(true);
  });

  it("leva só os juros contratuais à DRE e protege as parcelas contra descaracterização", async () => {
    const { user, company, category } = await setup();
    const debt = await createDebt(user.id, company.id, { name: "SAC", principalCents: 100_000, monthlyRateBps: 1000, installmentCount: 3, firstDueDate: today, amortization: "SAC", categoryId: category.id });
    const title = await rootClient.title.findFirstOrThrow({ where: { installmentGroupId: debt.installmentGroupId, installmentNumber: 1 } });
    const period = { from: today, to: today };
    const report = await getManagerialIncomeStatement(user.id, company.id, period);
    expect(report.operatingResultCents).toBe(0n);
    expect(report.financialLines).toEqual([{ label: "Juros contratuais de dívidas", cents: -10_000n }]);
    expect(report.outsideResult).toEqual([{ label: "Amortização de dívidas", cents: -33_333n }]);
    expect(report.totalCents).toBe(-10_000n);
    expect((await getDashboardInsights(user.id, company.id, period)).period.expenseCents).toBe(0n);
    await expect(cancelTitle(user.id, company.id, title.id, { reason: "Teste" })).rejects.toBeInstanceOf(DebtInstallmentManagedError);
    await expect(deleteTitle(user.id, company.id, title.id, { reason: "Teste" })).rejects.toBeInstanceOf(DebtInstallmentManagedError);
    await expect(deleteInstallmentPlan(user.id, company.id, debt.installmentGroupId, { reason: "Teste" })).rejects.toBeInstanceOf(DebtInstallmentManagedError);
    await expect(updateTitle(user.id, company.id, title.id, { description: title.description, categoryId: category.id, originalAmountCents: 1000, competenceDate: today, dueDate: today })).rejects.toBeInstanceOf(DebtInstallmentManagedError);
  });

  it("preserva pagamentos de parcelas removidas no legado e não considera cancelamento como quitação", async () => {
    const { user, company, account, category } = await setup();
    const debt = await createDebt(user.id, company.id, { name: "Legado", principalCents: 100_000, monthlyRateBps: 0, installmentCount: 2, firstDueDate: today, categoryId: category.id });
    const titles = await rootClient.title.findMany({ where: { installmentGroupId: debt.installmentGroupId }, orderBy: { installmentNumber: "asc" } });
    await registerSettlement(user.id, company.id, titles[0]!.id, { financialAccountId: account.id, principalAmountCents: 50_000, effectiveDate: today });
    // Simula registros antigos, anteriores às proteções de parcelas vinculadas.
    await rootClient.title.update({ where: { id: titles[0]!.id }, data: { deletedAt: new Date(), deletedByUserId: user.id, deleteReason: "Remoção antiga" } });
    await rootClient.title.update({ where: { id: titles[1]!.id }, data: { status: "CANCELLED", cancelReason: "Cancelamento antigo" } });
    const view = await getDebt(user.id, company.id, debt.id);
    expect(view.balanceCents).toBe(50_000n);
    expect(view.rows[0]!.state).toBe("PAID");
    expect(view.rows[1]!.state).toBe("CANCELLED");
    expect(view.hasPaymentHistory).toBe(true);
    expect(view.contractWarningsCount).toBe(2);
    expect(view.nextInstallment).toBeNull();
    expect((await getNetWorth(user.id, company.id)).debtsCents).toBe(50_000n);
  });

  it("concilia painel, calendário, fluxo e relatório mensal com devoluções, baixa futura e horizonte exato", async () => {
    const { user, company, account, category, revenue } = await setup();
    const month = today.slice(0, 7);
    const period = { from: `${month}-01`, to: addReportDays(`${month}-01`, 32).slice(0, 7) + "-01" };
    const sale = await createTitle(user.id, company.id, { type: "RECEIVABLE", description: "Venda", categoryId: revenue.id, originalAmountCents: 10_000, competenceDate: today, dueDate: today });
    const payment = await registerSettlement(user.id, company.id, sale.id, { financialAccountId: account.id, principalAmountCents: 10_000, effectiveDate: today });
    await registerSettlementRefund(user.id, company.id, payment.id, { financialAccountId: account.id, amountCents: 2000, effectiveDate: today, reason: "Devolução" });
    const future = await createTitle(user.id, company.id, { type: "PAYABLE", description: "Baixa futura", categoryId: category.id, originalAmountCents: 20_000, competenceDate: today, dueDate: today });
    await registerSettlement(user.id, company.id, future.id, { financialAccountId: account.id, principalAmountCents: 20_000, effectiveDate: addReportDays(today, 1) });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Último dia", categoryId: category.id, originalAmountCents: 5000, competenceDate: today, dueDate: addReportDays(today, 29) });
    await createTitle(user.id, company.id, { type: "PAYABLE", description: "Fora do horizonte", categoryId: category.id, originalAmountCents: 7000, competenceDate: today, dueDate: addReportDays(today, 30) });
    await createFinancialAccount(user.id, company.id, { name: "Conta futura", type: "BANK", openingBalanceCents: 900_000, openingDate: addReportDays(today, 1) });
    const projection = await getCashProjection(user.id, company.id, { days: 30 });
    const dashboard = await getDashboardOverview(user.id, company.id, { ...period, projectionDays: 30 });
    const calendar = await getFinancialCalendar(user.id, company.id, { month });
    const monthly = await getMonthlyReportData(user.id, company.id, month);
    const cash = await getCashFlowReport(user.id, company.id, { from: `${month}-01`, to: today });
    expect(projection.series).toHaveLength(30);
    expect(dashboard.cashProjectionSeries).toHaveLength(30);
    expect(projection.availableBalanceCents).toBe(108_000n);
    expect(projection.projectedBalanceCents).toBe(83_000n);
    expect(dashboard.projectedBalanceCents).toBe(projection.projectedBalanceCents);
    expect(monthly.projection.projectedCents).toBe(projection.projectedBalanceCents);
    expect(calendar.days.find((day) => day.date === today)?.payableCents).toBe(20_000n);
    expect(calendar.days.find((day) => day.date === today)?.projectedBalanceCents).toBe(projection.series[0]!.plannedBalanceCents);
    expect(monthly.cash).toEqual({ receivedCents: 8000n, paidCents: 0n });
    expect(calendar.totals.receivedCents - calendar.totals.paidCents).toBe(cash.totalCents);
    expect(monthly.cash.receivedCents - monthly.cash.paidCents).toBe(cash.totalCents);
  });

  it("pagamento futuro de fatura não libera limite nem apaga a dívida do patrimônio de hoje", async () => {
    const { user, company, account, category } = await setup();
    const card = await createCreditCard(user.id, company.id, { name: "Cartão", limitCents: 100_000, closingDay: 10, dueDay: 20 });
    const [purchase] = await createCreditCardPurchase(user.id, company.id, { cardId: card.id, description: "Compra", categoryId: category.id, totalAmountCents: 10_000, purchaseDate: "2026-01-05" });
    const settlement = await payCreditCardInvoice(user.id, company.id, purchase!.invoiceId, { financialAccountId: account.id, effectiveDate: addReportDays(today, 2) });
    expect((await rootClient.title.findUniqueOrThrow({ where: { id: settlement.titleId } })).status).toBe("SETTLED");
    const [summary] = await listCreditCards(user.id, company.id);
    expect(summary!.usedLimitCents).toBe(10_000n);
    expect((await getCreditCard(user.id, company.id, card.id)).usedLimitCents).toBe(10_000n);
    expect((await getCreditCardInvoice(user.id, company.id, purchase!.invoiceId)).invoice.remainingCents).toBe(10_000n);
    expect((await getNetWorth(user.id, company.id)).cardDebtCents).toBe(10_000n);
    const [afterPayment] = await listCreditCards(user.id, company.id, { today: addReportDays(today, 2) });
    expect(afterPayment!.usedLimitCents).toBe(0n);
  });
});
