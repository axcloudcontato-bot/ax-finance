import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withCompanyContext } from "@ax-finance/db";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { createCategory } from "../categories/create-category";
import { updateCategory } from "../categories/update-category";
import { createTitle } from "../titles/create-title";
import { registerSettlement } from "../titles/register-settlement";
import { setTitleScheduledPayment } from "../titles/title-operations";
import { setTitleCashPlan, setMinimumCashReserve } from "../titles/cash-planning";
import { closePeriod } from "../closures/close-period";
import { reopenPeriod } from "../closures/reopen-period";
import { getMonthlyReportData } from "../reports/monthly-report";
import { getOpenTitlesAgingReport } from "../reports/aging-report";
import { getReportSnapshot, listReportSnapshots, prepareMonthlyReportPdf } from "../reports/report-snapshots";
import { getCashProjection } from "../reports/cash-projection";
import { getManagerialIncomeStatement } from "../reports/managerial-income-statement";
import { allocateByRevenue, computeProfitability, getProfitabilityReport, type ProfitabilityLine } from "../reports/profitability-report";
import { createRecurrenceRule } from "../recurrences/create-recurrence-rule";
import { generateDueOccurrences } from "../recurrences/generate-due-occurrences";
import { createCostCenter } from "../cost-centers/cost-centers";
import { replaceTitleAllocations } from "../titles/title-allocations";
import { createDebt } from "../wealth/wealth";
import { createCreditCard, createCreditCardPurchase } from "../credit-cards";
import { addReportDays } from "../reports/report-period";
import { todayInTimeZone } from "../shared/today";
import { rootClient, resetDatabase } from "./test-db";

const today = todayInTimeZone();
const priorMonth = addReportDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
beforeEach(resetDatabase);
afterAll(() => rootClient.$disconnect());
async function setup() {
  const user = await registerUser({ email: `${randomUUID()}@gestao.example.test`, name: "Gestão", password: "senha-forte-123" });
  const company = await createCompany(user.id, { name: "Gestão financeira" });
  const account = await createFinancialAccount(user.id, company.id, { name: "Banco", type: "BANK", openingBalanceCents: 10000, openingDate: "2020-01-01" });
  const revenue = await createCategory(user.id, company.id, { name: "Serviços", nature: "OPERATING_REVENUE" });
  const variable = await createCategory(user.id, company.id, { name: "Insumos", nature: "COST", costBehavior: "VARIABLE" });
  const fixed = await createCategory(user.id, company.id, { name: "Aluguel", nature: "EXPENSE", costBehavior: "FIXED" });
  return { user, company, account, revenue, variable, fixed };
}
type Context = Awaited<ReturnType<typeof setup>>;
function title(c: Context, type: "RECEIVABLE" | "PAYABLE", cents: number, dueDate = today, extra = {}) {
  return createTitle(c.user.id, c.company.id, { type, description: type === "RECEIVABLE" ? "Venda" : "Folha", categoryId: type === "RECEIVABLE" ? c.revenue.id : c.variable.id, originalAmountCents: cents, competenceDate: dueDate, dueDate, ...extra });
}

describe("histórico preservado", () => {
  it("envio de mês fechado mantém o mesmo PDF mesmo que a empresa reabra e feche outra versão", async () => {
    const c = await setup();
    await closePeriod(c.user.id, c.company.id, { period: priorMonth });
    const first = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { sourceKey: "outbox:fechado" });
    await reopenPeriod(c.user.id, c.company.id, { period: priorMonth, reason: "Ajuste" });
    await title(c, "RECEIVABLE", 10000, `${priorMonth}-05`);
    await closePeriod(c.user.id, c.company.id, { period: priorMonth });
    const retry = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { sourceKey: "outbox:fechado" });
    expect(retry.snapshotId).toBe(first.snapshotId);
    expect(retry.pdf.equals(first.pdf)).toBe(true);
    expect(retry.data.result.revenueCents).toBe(0n);
  });
  it("rentabilidade preservada mantém a classificação anterior e valida o mês da versão", async () => {
    const c = await setup();
    await title(c, "RECEIVABLE", 5000000, `${priorMonth}-05`);
    await title(c, "PAYABLE", 2000000, `${priorMonth}-05`);
    await title(c, "PAYABLE", 1800000, `${priorMonth}-05`, { categoryId: c.fixed.id });
    const archived = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth);
    await updateCategory(c.user.id, c.company.id, c.variable.id, { name: c.variable.name, nature: c.variable.nature, costBehavior: "FIXED" });
    const range = { from: `${priorMonth}-01`, to: addReportDays(`${today.slice(0, 7)}-01`, -1) };
    const current = await getProfitabilityReport(c.user.id, c.company.id, range);
    const frozen = await getProfitabilityReport(c.user.id, c.company.id, { ...range, snapshotId: archived.snapshotId });
    expect(current.totals.contributionBps).toBe(10000);
    expect(frozen.totals.contributionBps).toBe(6000);
    expect(frozen.totals.breakEvenCents).toBe(3000000n);
    expect(frozen.capturedAsOf).toBe(today);
    const dre = await getManagerialIncomeStatement(c.user.id, c.company.id, { ...range, snapshotId: archived.snapshotId });
    expect(dre.operatingResultCents).toBe(1200000n);
    expect(dre.capturedAsOf).toBe(today);
    await expect(getProfitabilityReport(c.user.id, c.company.id, { from: today, to: today, snapshotId: archived.snapshotId })).rejects.toThrow();
  });
  it("pagamento posterior não apaga inadimplência, nomes ou bytes do PDF; reabrir cria nova versão", async () => {
    const c = await setup();
    const sale = await title(c, "RECEIVABLE", 10000, `${priorMonth}-05`);
    await closePeriod(c.user.id, c.company.id, { period: priorMonth });
    const [first] = await listReportSnapshots(c.user.id, c.company.id, priorMonth);
    const pdf = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { snapshotId: first!.id });
    expect(pdf.data.delinquency.overdueReceivableCents).toBe(10000n);
    await registerSettlement(c.user.id, c.company.id, sale.id, { financialAccountId: c.account.id, principalAmountCents: 10000, effectiveDate: today });
    await updateCategory(c.user.id, c.company.id, c.revenue.id, { name: "Nome atual", nature: "OPERATING_REVENUE" });
    expect((await getOpenTitlesAgingReport(c.user.id, c.company.id, {})).totalCents).toBe(0n);
    const frozen = await getOpenTitlesAgingReport(c.user.id, c.company.id, { snapshotId: first!.id });
    expect(frozen.totalCents).toBe(10000n);
    expect(frozen.entries[0]!.categoryName).toBe("Serviços");
    expect((await getMonthlyReportData(c.user.id, c.company.id, priorMonth)).delinquency.overdueReceivableCents).toBe(10000n);
    expect((await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { snapshotId: first!.id })).pdf.equals(pdf.pdf)).toBe(true);
    await closePeriod(c.user.id, c.company.id, { period: priorMonth });
    expect(await listReportSnapshots(c.user.id, c.company.id, priorMonth)).toHaveLength(1);
    await reopenPeriod(c.user.id, c.company.id, { period: priorMonth, reason: "Revisão" });
    await closePeriod(c.user.id, c.company.id, { period: priorMonth });
    expect((await listReportSnapshots(c.user.id, c.company.id, priorMonth)).map((v) => v.version)).toEqual([2, 1]);
    expect((await getMonthlyReportData(c.user.id, c.company.id, priorMonth)).delinquency.overdueReceivableCents).toBe(0n);
    expect((await getReportSnapshot(c.user.id, c.company.id, first!.id)).data.monthly.delinquency.overdueReceivableCents).toBe(10000n);
  });
  it("emissão aberta preserva PDF e repetição do mesmo envio é idempotente", async () => {
    const c = await setup();
    const one = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { sourceKey: "outbox:teste" });
    await title(c, "RECEIVABLE", 9999, `${priorMonth}-10`);
    const again = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth, { sourceKey: "outbox:teste" });
    expect(again.snapshotId).toBe(one.snapshotId);
    expect(again.pdf.equals(one.pdf)).toBe(true);
    expect((await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth)).snapshotId).not.toBe(one.snapshotId);
  });
  it("RLS e domínio impedem alterar versões, consultar outra empresa e acessar agregado com escopo restrito", async () => {
    const c = await setup();
    const snapshot = await prepareMonthlyReportPdf(c.user.id, c.company.id, priorMonth);
    await expect(withCompanyContext(c.user.id, c.company.id, (tx) => tx.reportSnapshot.delete({ where: { id: snapshot.snapshotId } }))).rejects.toThrow();
    await expect(withCompanyContext(c.user.id, c.company.id, (tx) => tx.reportSnapshot.update({ where: { id: snapshot.snapshotId }, data: { version: 99 } }))).rejects.toThrow();
    const other = await createCompany(c.user.id, { name: "Outra" });
    await expect(getReportSnapshot(c.user.id, other.id, snapshot.snapshotId)).rejects.toThrow();
    const restricted = await registerUser({ email: `${randomUUID()}@restrito.example.test`, name: "Consulta", password: "senha-forte-123" });
    await rootClient.membership.create({ data: { userId: restricted.id, companyId: c.company.id, role: "ACCOUNTANT", accessScope: "RESTRICTED" } });
    await expect(getReportSnapshot(restricted.id, c.company.id, snapshot.snapshotId)).rejects.toThrow();
    expect(await withCompanyContext(restricted.id, c.company.id, (tx) => tx.reportSnapshot.count())).toBe(0);
  });
});

describe("previsão provável e reserva", () => {
  it("recebimento previsto antes do vencimento entra no horizonte sem antecipar o contrato", async () => {
    const c = await setup();
    const sale = await title(c, "RECEIVABLE", 10000, addReportDays(today, 45));
    await setTitleCashPlan(c.user.id, c.company.id, sale.id, { expectedReceiptDate: addReportDays(today, 2), receiptProbabilityBps: 10000 });
    const report = await getCashProjection(c.user.id, c.company.id);
    expect(report.projectedBalanceCents).toBe(10000n);
    expect(report.expectedBalanceCents).toBe(20000n);
  });
  it("visão restrita não compara saldo parcial com a reserva global nem estima recorrências invisíveis", async () => {
    const c = await setup();
    await setMinimumCashReserve(c.user.id, c.company.id, { minimumCashReserveCents: 50000 });
    const user = await registerUser({ email: `${randomUUID()}@parcial.example.test`, name: "Parcial", password: "senha-forte-123" });
    const membership = await rootClient.membership.create({ data: { userId: user.id, companyId: c.company.id, role: "FINANCE_ADMIN", accessScope: "RESTRICTED" } });
    await rootClient.membershipFinancialAccount.create({ data: { companyId: c.company.id, membershipId: membership.id, financialAccountId: c.account.id } });
    const report = await getCashProjection(user.id, c.company.id);
    expect(report.isPartialScope).toBe(true);
    expect(report.availableBalanceCents).toBe(10000n);
    expect(report.minimumReserveCents).toBe(0n);
    expect(report.includeEstimates).toBe(false);
    await expect(setMinimumCashReserve(user.id, c.company.id, { minimumCashReserveCents: 100 })).rejects.toThrow();
  });
  it("promessa prevalece, probabilidade pondera e atraso identifica o pagamento que compromete a reserva", async () => {
    const c = await setup();
    const sale = await title(c, "RECEIVABLE", 20000);
    const payment = await title(c, "PAYABLE", 12000, today);
    await setTitleCashPlan(c.user.id, c.company.id, sale.id, { expectedReceiptDate: addReportDays(today, 1), promisedReceiptDate: addReportDays(today, 2), receiptProbabilityBps: 5000, expectedAccountId: c.account.id });
    await setTitleScheduledPayment(c.user.id, c.company.id, payment.id, addReportDays(today, 3));
    await setMinimumCashReserve(c.user.id, c.company.id, { minimumCashReserveCents: 5000 });
    const report = await getCashProjection(c.user.id, c.company.id, { receiptDelayDays: 5 });
    expect(report.expectedBalanceCents).toBe(8000n);
    expect(report.minimumExpectedCents).toBe(8000n);
    expect(report.minimumStressedCents).toBe(-2000n);
    expect(report.reserveNeededCents).toBe(7000n);
    expect(report.firstBelowReserveStressDate).toBe(addReportDays(today, 3));
    expect(report.deficitContributors.map((item) => item.titleId)).toEqual([payment.id]);
    expect(report.planningItems.find((item) => item.titleId === sale.id)?.projectionDate).toBe(addReportDays(today, 2));
    expect((await rootClient.title.findUniqueOrThrow({ where: { id: sale.id } })).dueDate.toISOString().slice(0, 10)).toBe(today);
    expect(await rootClient.auditEvent.count({ where: { companyId: c.company.id, eventType: "TITLE_CASH_PLAN_UPDATED" } })).toBe(1);
    await expect(setTitleCashPlan(c.user.id, c.company.id, sale.id, { expectedReceiptDate: "2026-02-30", receiptProbabilityBps: 10000 })).rejects.toThrow();
    await expect(setMinimumCashReserve(c.user.id, c.company.id, { minimumCashReserveCents: -1 })).rejects.toThrow();
  });
  it("datas além do horizonte retiram recebimentos do cenário provável sem mudar o contratual", async () => {
    const c = await setup();
    const sale = await title(c, "RECEIVABLE", 10000);
    await setTitleCashPlan(c.user.id, c.company.id, sale.id, { expectedReceiptDate: addReportDays(today, 40), receiptProbabilityBps: 10000 });
    const report = await getCashProjection(c.user.id, c.company.id);
    expect(report.projectedBalanceCents).toBe(20000n);
    expect(report.expectedBalanceCents).toBe(10000n);
  });
  it("recorrência estimada desaparece quando materializada, sem duplicar nem recriar ocorrência cancelada", async () => {
    const c = await setup();
    const rule = await createRecurrenceRule(c.user.id, c.company.id, { type: "PAYABLE", description: "Mensalidade", categoryId: c.fixed.id, amountCents: 5000, dayOfMonth: Number(today.slice(8)), startDate: today });
    const estimated = await getCashProjection(c.user.id, c.company.id);
    expect(estimated.estimatesCount).toBe(1);
    expect(estimated.expectedBalanceCents).toBe(5000n);
    expect(estimated.projectedBalanceCents).toBe(10000n);
    expect((await getCashProjection(c.user.id, c.company.id, { includeEstimates: false })).expectedBalanceCents).toBe(10000n);
    await generateDueOccurrences(c.user.id, c.company.id);
    const materialized = await getCashProjection(c.user.id, c.company.id);
    expect(materialized.estimatesCount).toBe(0);
    expect(materialized.expectedBalanceCents).toBe(estimated.expectedBalanceCents);
    await rootClient.title.updateMany({ where: { recurrenceRuleId: rule.id, recurrenceOccurrenceDate: new Date(today) }, data: { status: "CANCELLED" } });
    expect((await getCashProjection(c.user.id, c.company.id)).estimatesCount).toBe(0);
  });
  it("baixa futura usa caixa líquido uma vez e mantém saldo contratual pendente hoje", async () => {
    const c = await setup();
    const sale = await title(c, "RECEIVABLE", 10000);
    await registerSettlement(c.user.id, c.company.id, sale.id, { financialAccountId: c.account.id, principalAmountCents: 4000, discountCents: 1000, feesCents: 200, effectiveDate: addReportDays(today, 2) });
    await setTitleCashPlan(c.user.id, c.company.id, sale.id, { expectedReceiptDate: addReportDays(today, 4), receiptProbabilityBps: 5000 });
    const report = await getCashProjection(c.user.id, c.company.id, { receiptDelayDays: 0 });
    expect(report.availableBalanceCents).toBe(10000n);
    expect(report.projectedBalanceCents).toBe(20000n);
    expect(report.expectedBalanceCents).toBe(16300n);
    expect(report.series[2]!.expectedReceiptsCents).toBe(3800n);
    expect(report.series[4]!.expectedReceiptsCents).toBe(2500n);
    const dre = await getManagerialIncomeStatement(c.user.id, c.company.id, { from: today, to: addReportDays(today, 10) });
    expect(dre.financialResultCents).toBe(0n);
  });
});

describe("rentabilidade gerencial", () => {
  const line = (nature: string, costBehavior: string, signedCents: bigint, costCenterId: string | null = "A"): ProfitabilityLine => ({ nature, costBehavior, signedCents, costCenterId, costCenterName: costCenterId, categoryId: `${nature}-${costBehavior}`, categoryName: `${nature}-${costBehavior}` });
  it("calcula contribuição de 60% e equilíbrio de R$ 30 mil com receita 50 mil, variáveis 20 mil e fixos 18 mil", () => {
    const report = computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 5000000n), line("COST", "VARIABLE", -2000000n), line("EXPENSE", "FIXED", -1800000n)]);
    expect(report.totals.contributionCents).toBe(3000000n);
    expect(report.totals.contributionBps).toBe(6000);
    expect(report.totals.breakEvenCents).toBe(3000000n);
    expect(report.totals.resultCents).toBe(1200000n);
  });
  it("não inventa comportamento de custo, contribuição ou equilíbrio sem base completa e margem positiva", () => {
    const incomplete = computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 10000n), line("COST", "UNCLASSIFIED", -1000n)]);
    expect(incomplete.totals.contributionCents).toBeNull();
    expect(incomplete.totals.breakEvenCents).toBeNull();
    expect(incomplete.totals.resultCents).toBe(9000n);
    const negative = computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 10000n), line("COST", "VARIABLE", -12000n)]);
    expect(negative.totals.contributionCents).toBe(-2000n);
    expect(negative.totals.breakEvenCents).toBeNull();
    expect(computeProfitability([line("EXPENSE", "FIXED", -100n)]).totals.breakEvenCents).toBeNull();
  });
  it("rateia fixos proporcionalmente preservando centavos e sem duplicar o total da empresa", () => {
    expect(computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 7n), line("COST", "VARIABLE", -4n), line("EXPENSE", "FIXED", -1n)]).totals.breakEvenCents).toBe(3n);
    expect([...allocateByRevenue(101n, [{ id: "C", revenueCents: 1n }, { id: "B", revenueCents: 1n }, { id: "A", revenueCents: 1n }])]).toEqual([["A", 34n], ["B", 34n], ["C", 33n]]);
    const report = computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 10000n, "A"), line("OPERATING_REVENUE", "UNCLASSIFIED", 30000n, "B"), line("EXPENSE", "FIXED", -10001n, null)], "REVENUE");
    expect(report.allocatedFixedCents).toBe(10001n);
    expect(report.rows.reduce((sum, row) => sum + row.resultCents, 0n)).toBe(report.totals.resultCents);
    expect(report.rows.find((row) => row.id === "UNASSIGNED")!.fixedCents).toBe(0n);
  });
  it("gastos variáveis sem centro impedem margens enganosas dos projetos", () => {
    const report = computeProfitability([line("OPERATING_REVENUE", "UNCLASSIFIED", 10000n), line("COST", "VARIABLE", -2000n, null)]);
    expect(report.rows.find((row) => row.id === "A")!.contributionCents).toBeNull();
    expect(report.totals.contributionCents).toBe(8000n);
  });
  it("usa rateios uma vez, inclui compras no cartão e exclui faturas e parcelas de empréstimo", async () => {
    const c = await setup();
    const center = await createCostCenter(c.user.id, c.company.id, { name: "Serviço A" });
    const other = await createCostCenter(c.user.id, c.company.id, { name: "Serviço B" });
    await title(c, "RECEIVABLE", 5000000, today, { costCenterId: center.id });
    const expense = await title(c, "PAYABLE", 2000000, today, { categoryId: c.fixed.id });
    await replaceTitleAllocations(c.user.id, c.company.id, expense.id, { allocations: [{ categoryId: c.variable.id, costCenterId: center.id, amountCents: 1000000 }, { categoryId: c.variable.id, costCenterId: other.id, amountCents: 1000000 }] });
    const card = await createCreditCard(c.user.id, c.company.id, { name: "Cartão", limitCents: 1000000, closingDay: 10, dueDay: 20 });
    await createCreditCardPurchase(c.user.id, c.company.id, { cardId: card.id, description: "Material", categoryId: c.variable.id, costCenterId: center.id, totalAmountCents: 10000, purchaseDate: today });
    await createDebt(c.user.id, c.company.id, { name: "Crédito", principalCents: 100000, monthlyRateBps: 1000, installmentCount: 2, firstDueDate: today, categoryId: c.variable.id });
    const report = await getProfitabilityReport(c.user.id, c.company.id, { from: today, to: today });
    expect(report.totals.revenueCents).toBe(5000000n);
    expect(report.totals.variableCents).toBe(2010000n);
    expect(report.totals.fixedCents).toBe(0n);
    expect(report.rows[0]!.name).toBe("Serviço A");
  });
});
