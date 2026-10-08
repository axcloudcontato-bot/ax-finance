import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import type { CategoryNature } from "@ax-finance/db";
import { computeAccountBalanceDeltas } from "../financial-accounts/account-balances";
import { addReportDays, reportPeriod } from "./report-period";
import { getCompanyToday } from "../shared/today";

export const cashFlowReportInput = reportPeriod.transform(({ from, to }) => ({ from: new Date(from), to: new Date(to) }));

export type CashFlowReportInput = z.infer<typeof cashFlowReportInput>;

export interface CashFlowEntry {
  id: string;
  kind: "SETTLEMENT" | "REFUND";
  titleId: string;
  accountName: string;
  settlementId: string;
  effectiveDate: Date;
  titleType: "RECEIVABLE" | "PAYABLE";
  titleDescription: string;
  categoryName: string;
  categoryNature: CategoryNature;
  cashDeltaCents: bigint;
}

/**
 * Fluxo de caixa REALIZADO (Seção 13): só baixas de título com data efetiva
 * no período, nunca estornadas. Transferências entre contas próprias ficam
 * de fora por definição (Seção 8: não são receita/despesa no consolidado).
 * Agrupado pela natureza da categoria (operacional/investimento/
 * financiamento/patrimônio), que já existe desde a Seção 9.
 */
export async function getCashFlowReport(userId: string, companyId: string, input: unknown) {
  const { from, to } = cashFlowReportInput.parse(input);
  await assertActiveMembership(userId, companyId);
  const today = await getCompanyToday(userId, companyId);
  const closingBalanceDate = to.toISOString().slice(0, 10) < today ? to.toISOString().slice(0, 10) : today;
  const beforeFrom = addReportDays(from.toISOString().slice(0, 10), -1);
  const openingBalanceDate = beforeFrom < today ? beforeFrom : today;
  const effectiveTo = new Date(closingBalanceDate);

  const { settlements, refunds, openingBalanceCents, closingBalanceCents, otherBalanceChangesCents } = await withCompanyContext(userId, companyId, async (tx) => {
    const [accounts, openingDeltas, closingDeltas] = await Promise.all([
      tx.financialAccount.findMany({ where: { companyId } }),
      computeAccountBalanceDeltas(tx, companyId, new Date(openingBalanceDate)),
      computeAccountBalanceDeltas(tx, companyId, effectiveTo),
    ]);
    const balance = (at: Date, deltas: Map<string, bigint>) => accounts.reduce((total, account) =>
      total + (account.openingDate <= at ? account.openingBalanceCents : BigInt(0)) + (deltas.get(account.id) ?? BigInt(0)), BigInt(0));
    const [transfers, adjustments] = await Promise.all([
      tx.transfer.findMany({ where: { companyId, reversedAt: null, transferDate: { gte: from, lte: effectiveTo } }, select: { feeCents: true } }),
      tx.balanceAdjustment.findMany({ where: { companyId, reversedAt: null, effectiveDate: { gte: from, lte: effectiveTo } }, select: { amountCents: true } }),
    ]);
    const otherBalanceChangesCents = accounts.filter((account) => account.openingDate >= from && account.openingDate <= effectiveTo).reduce((total, account) => total + account.openingBalanceCents, BigInt(0))
      + adjustments.reduce((total, adjustment) => total + adjustment.amountCents, BigInt(0))
      - transfers.reduce((total, transfer) => total + transfer.feeCents, BigInt(0));
    return {
    otherBalanceChangesCents,
    openingBalanceCents: balance(new Date(openingBalanceDate), openingDeltas),
    closingBalanceCents: balance(effectiveTo, closingDeltas),
    settlements: await tx.settlement.findMany({
      where: {
        companyId,
        reversedAt: null,
        effectiveDate: { gte: from, lte: effectiveTo },
      },
      include: {
        financialAccount: { select: { name: true } },
        title: { select: { id: true, type: true, description: true, category: true } },
      },
      orderBy: { effectiveDate: "asc" },
    }),
    refunds: await tx.settlementRefund.findMany({
      where: { companyId, reversedAt: null, effectiveDate: { gte: from, lte: effectiveTo } },
      include: { financialAccount: { select: { name: true } }, settlement: { include: { title: { select: { id: true, type: true, description: true, category: true } } } } },
      orderBy: { effectiveDate: "asc" },
    }),
  }; });

  const entries: CashFlowEntry[] = settlements.map((settlement) => ({
    id: settlement.id,
    kind: "SETTLEMENT",
    titleId: settlement.title.id,
    accountName: settlement.financialAccount.name,
    settlementId: settlement.id,
    effectiveDate: settlement.effectiveDate,
    titleType: settlement.title.type,
    titleDescription: settlement.title.description,
    categoryName: settlement.title.category.name,
    categoryNature: settlement.title.category.nature,
    cashDeltaCents: settlementCashDelta(settlement.title.type, settlement),
  }));
  entries.push(...refunds.map((refund) => ({
    id: refund.id,
    kind: "REFUND" as const,
    titleId: refund.settlement.title.id,
    accountName: refund.financialAccount.name,
    settlementId: refund.settlementId,
    effectiveDate: refund.effectiveDate,
    titleType: refund.settlement.title.type,
    titleDescription: `${refund.settlement.title.description} — devolução/reembolso`,
    categoryName: refund.settlement.title.category.name,
    categoryNature: refund.settlement.title.category.nature,
    cashDeltaCents: refund.settlement.title.type === "RECEIVABLE" ? -refund.amountCents : refund.amountCents,
  })));
  entries.sort((left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime());

  const byNature = new Map<CategoryNature, bigint>();
  for (const entry of entries) {
    byNature.set(entry.categoryNature, (byNature.get(entry.categoryNature) ?? BigInt(0)) + entry.cashDeltaCents);
  }

  const totalCents = entries.reduce((sum, entry) => sum + entry.cashDeltaCents, BigInt(0));

  return {
    from,
    to,
    entries,
    subtotalsByNature: [...byNature.entries()].map(([nature, cents]) => ({ nature, cents })),
    totalCents,
    openingBalanceCents,
    closingBalanceCents,
    otherBalanceChangesCents,
    balanceDifferenceCents: closingBalanceCents - openingBalanceCents - totalCents - otherBalanceChangesCents,
    today,
    openingBalanceDate,
    closingBalanceDate,
  };
}
