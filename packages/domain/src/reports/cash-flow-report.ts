import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { settlementCashDelta } from "../titles/settlement-cash-delta";
import type { CategoryNature } from "@ax-finance/db";

export const cashFlowReportInput = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type CashFlowReportInput = z.infer<typeof cashFlowReportInput>;

export interface CashFlowEntry {
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

  const { settlements, refunds } = await withCompanyContext(userId, companyId, async (tx) => ({
    settlements: await tx.settlement.findMany({
      where: {
        companyId,
        reversedAt: null,
        effectiveDate: { gte: from, lte: to },
      },
      include: {
        title: { select: { type: true, description: true, category: true } },
      },
      orderBy: { effectiveDate: "asc" },
    }),
    refunds: await tx.settlementRefund.findMany({
      where: { companyId, reversedAt: null, effectiveDate: { gte: from, lte: to } },
      include: { settlement: { include: { title: { select: { type: true, description: true, category: true } } } } },
      orderBy: { effectiveDate: "asc" },
    }),
  }));

  const entries: CashFlowEntry[] = settlements.map((settlement) => ({
    settlementId: settlement.id,
    effectiveDate: settlement.effectiveDate,
    titleType: settlement.title.type,
    titleDescription: settlement.title.description,
    categoryName: settlement.title.category.name,
    categoryNature: settlement.title.category.nature,
    cashDeltaCents: settlementCashDelta(settlement.title.type, settlement),
  }));
  entries.push(...refunds.map((refund) => ({
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
  };
}
