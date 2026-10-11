import { projectCashBalances } from "./project-cash-balances";
import { OPERATIONAL_ACCOUNT } from "../financial-accounts/operational";
import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { getCompanyToday } from "../shared/today";
import { addReportDays, reportDate } from "./report-period";
import { computeOccurrenceDates } from "../recurrences/recurrence-dates";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import type { ProjectionItem } from "./project-cash-balances";

const projectionInput = z.object({
  today: reportDate.optional(),
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
  receiptDelayDays: z.number().int().min(0).max(60).default(5),
  includeEstimates: z.boolean().default(true),
});

/** Projeção de saldos de principal: a fatura representa as compras do cartão uma única vez. */
export async function getCashProjection(userId: string, companyId: string, input: unknown = {}) {
  const data = projectionInput.parse(input);
  const membership = await assertActiveMembership(userId, companyId);
  const isPartialScope = membership.role !== "OWNER" && membership.accessScope === "RESTRICTED";
  const today = data.today ?? await getCompanyToday(userId, companyId);
  const through = addReportDays(today, data.days - 1);
  return withCompanyContext(userId, companyId, async (tx) => {
    const [accounts, deltas, titles, company, rules, occurrences, closed] = await Promise.all([
      tx.financialAccount.findMany({ where: { companyId, status: "ACTIVE", includedInAvailableTotal: true, ...OPERATIONAL_ACCOUNT, openingDate: { lte: new Date(today) } } }),
      computeAccountBalanceDeltas(tx, companyId, new Date(today)),
      tx.title.findMany({
        where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, OR: [
          { dueDate: { lte: new Date(through) } }, { expectedReceiptDate: { lte: new Date(through) } },
          { promisedReceiptDate: { lte: new Date(through) } }, { scheduledPaymentDate: { lte: new Date(through) } },
          { settlements: { some: { reversedAt: null, effectiveDate: { gt: new Date(today), lte: new Date(through) } } } },
        ] },
        include: { settlements: { where: { reversedAt: null } }, creditCardInvoice: { select: { id: true } }, expectedAccount: { select: { type: true, status: true, includedInAvailableTotal: true } } },
        orderBy: { dueDate: "asc" },
      }),
      tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { minimumCashReserveCents: true } }),
      isPartialScope ? Promise.resolve([]) : tx.recurrenceRule.findMany({ where: { companyId, status: "ACTIVE", startDate: { lte: new Date(through) } } }),
      isPartialScope ? Promise.resolve([]) : tx.title.findMany({ where: { companyId, recurrenceRuleId: { not: null }, recurrenceOccurrenceDate: { gte: new Date(today), lte: new Date(through) } }, select: { recurrenceRuleId: true, recurrenceOccurrenceDate: true } }),
      tx.periodClosure.findMany({ where: { companyId, status: "CLOSED" }, select: { period: true } }),
    ]);
    const availableBalanceCents = accounts.reduce((total, account) => total + account.openingBalanceCents + (deltas.get(account.id) ?? BigInt(0)), BigInt(0));
    const items = titles.map((title) => ({
      titleId: title.id, type: title.type, description: title.description,
      dueDate: title.dueDate.toISOString().slice(0, 10),
      isCardInvoice: Boolean(title.creditCardInvoice),
      projectionDate: (title.type === "RECEIVABLE" ? title.promisedReceiptDate ?? title.expectedReceiptDate : title.scheduledPaymentDate)?.toISOString().slice(0, 10) ?? title.dueDate.toISOString().slice(0, 10),
      receiptProbabilityBps: title.receiptProbabilityBps,
      expectedAccountId: title.expectedAccountId,
      dateSource: title.type === "RECEIVABLE" ? title.promisedReceiptDate ? "Promessa de pagamento" : title.expectedReceiptDate ? "Data provável" : "Vencimento" : title.scheduledPaymentDate ? "Agendamento bancário" : "Vencimento",
      isEstimate: false,
      contractualCents: title.originalAmountCents - title.settlements.filter((s) => s.effectiveDate <= new Date(today)).reduce((sum, s) => sum + s.principalAmountCents + s.discountCents, BigInt(0)),
      remainingCents: title.originalAmountCents - title.settlements.reduce((sum, s) => sum + s.principalAmountCents + s.discountCents, BigInt(0)),
    })).filter((item) => item.contractualCents > BigInt(0) && (item.dueDate <= through || item.projectionDate <= through));
    const accountIds = new Set(accounts.map((account) => account.id));
    const eligibleItems = items.filter((item) => !item.expectedAccountId || accountIds.has(item.expectedAccountId));
    const futureItems: ProjectionItem[] = titles.flatMap((title) => title.settlements.filter((settlement) => settlement.effectiveDate > new Date(today) && settlement.effectiveDate <= new Date(through) && accountIds.has(settlement.financialAccountId)).map((settlement) => {
      const cents = settlementCashDelta(title.type, settlement);
      return { titleId: title.id, description: `${title.description} (baixa futura cadastrada)`, type: cents >= BigInt(0) ? "RECEIVABLE" as const : "PAYABLE" as const, dueDate: settlement.effectiveDate.toISOString().slice(0, 10), remainingCents: cents < BigInt(0) ? -cents : cents, excludeFromContractual: true };
    }));
    const existing = new Set(occurrences.map((title) => `${title.recurrenceRuleId}:${title.recurrenceOccurrenceDate?.toISOString().slice(0, 10)}`));
    const closedMonths = new Set(closed.map((closure) => closure.period));
    const estimates: ProjectionItem[] = rules.flatMap((rule) => computeOccurrenceDates(rule.startDate.toISOString().slice(0, 10), rule.dayOfMonth, rule.endDate?.toISOString().slice(0, 10) ?? null, through)
      .filter((date) => date >= today && !closedMonths.has(date.slice(0, 7)) && !existing.has(`${rule.id}:${date}`))
      .map((date) => ({ type: rule.type, description: `${rule.description} (recorrência estimada)`, dueDate: date, remainingCents: rule.amountCents, isEstimate: true })));
    const projectionItems: ProjectionItem[] = [...eligibleItems, ...futureItems, ...estimates];
    return { today, through, days: data.days, isPartialScope, receiptDelayDays: data.receiptDelayDays, includeEstimates: data.includeEstimates && !isPartialScope, availableBalanceCents, items: projectionItems, futureItems,
      estimatesCount: estimates.length, unassignedCount: eligibleItems.filter((item) => !item.expectedAccountId).length + estimates.length,
      excludedAccountCount: items.length - eligibleItems.length,
      planningItems: eligibleItems,
      ...projectCashBalances(today, through, availableBalanceCents, projectionItems, { minimumReserveCents: isPartialScope ? BigInt(0) : company.minimumCashReserveCents, receiptDelayDays: data.receiptDelayDays, includeEstimates: data.includeEstimates && !isPartialScope }) };
  });
}
