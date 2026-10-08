import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { NATURE_LABEL } from "../categories/nature-label";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { reportPeriod } from "./report-period";

export const managerialIncomeStatementInput = reportPeriod;

export type ManagerialIncomeStatementInput = z.infer<typeof managerialIncomeStatementInput>;

/** Naturezas que formam o resultado operacional. As demais são movimentação de capital, não lucro. */
const OPERATING_NATURES = new Set(["OPERATING_REVENUE", "COST", "EXPENSE"]);

export interface IncomeStatementLine {
  label: string;
  cents: bigint;
}

function add(map: Map<string, bigint>, label: string, cents: bigint) {
  map.set(label, (map.get(label) ?? BigInt(0)) + cents);
}

function sortedLines(map: Map<string, bigint>): IncomeStatementLine[] {
  return Array.from(map.entries())
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => (b.cents > a.cents ? 1 : b.cents < a.cents ? -1 : 0));
}

const sum = (lines: IncomeStatementLine[]) => lines.reduce((total, line) => total + line.cents, BigInt(0));

/**
 * DRE gerencial (Seção 13), por competência:
 *
 * 1. Resultado OPERACIONAL: usa competenceDate e o valor ORIGINAL do título (não a baixa), incluindo
 *    os ainda em aberto; título cancelado fica de fora. Só natureza de receita, custo e despesa.
 *    Compras no cartão entram pela própria categoria, e o título da fatura é ignorado.
 * 2. Resultado FINANCEIRO: o que só existe na baixa e o título original não mostra. Juros e multas
 *    pagos e recebidos, tarifas e taxas retidas, descontos obtidos e concedidos, pela data efetiva
 *    da baixa (não estornada). É onde aparece o juro de uma fatura de cartão ou de um boleto atrasado.
 * 3. FORA do resultado: investimento, financiamento, patrimônio e transferência técnica. Aporte,
 *    retirada de sócio, amortização de empréstimo e compra de equipamento mexem no caixa, não no lucro;
 *    ficam listados à parte, só para conferência, e não entram no total.
 *
 * Agrupa por managerialGroup da categoria; sem grupo, cai no rótulo da natureza — nenhuma categoria
 * fica de fora por falta de configuração.
 */
export async function getManagerialIncomeStatement(userId: string, companyId: string, input: unknown) {
  const data = managerialIncomeStatementInput.parse(input);
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "MANAGERIAL_DRE");

  const range = { gte: new Date(data.from), lte: new Date(data.to) };
  const { titles, cardPurchases, settlements, refunds } = await withCompanyContext(userId, companyId, async (tx) => ({
    // O título da fatura de cartão fica de fora: o gasto entra pelas compras (abaixo), cada uma na
    // sua categoria e competência. Contar os dois somaria o mesmo dinheiro duas vezes.
    titles: await tx.title.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { not: "CANCELLED" },
        competenceDate: range,
        creditCardInvoice: null,
      },
      include: { category: true, allocations: { include: { category: true } } },
    }),
    cardPurchases: await tx.creditCardPurchase.findMany({
      where: { companyId, canceledAt: null, competenceDate: range },
      include: { category: true },
    }),
    refunds: await tx.settlementRefund.findMany({ where: { companyId, reversedAt: null, effectiveDate: range }, select: { amountCents: true } }),
    settlements: await tx.settlement.findMany({
      where: {
        companyId,
        reversedAt: null,
        effectiveDate: range,
        OR: [{ interestPenaltyCents: { gt: 0 } }, { feesCents: { gt: 0 } }, { discountCents: { gt: 0 } }],
      },
      select: { interestPenaltyCents: true, feesCents: true, discountCents: true, title: { select: { type: true } } },
    }),
  }));

  const operating = new Map<string, bigint>();
  const outside = new Map<string, bigint>();
  const byNature = new Map<string, bigint>();
  const natureGroups = new Map<string, { id: string; label: string; nature: string; cents: bigint }>();
  const categoryDetails = new Map<string, { categoryId: string; categoryName: string; nature: string; group: string; cents: bigint; count: number }>();
  const ungrouped = new Set<string>();
  let unusualSignCount = 0;
  const record = (category: { id: string; name: string; managerialGroup: string | null; nature: string }, cents: bigint) => {
    const label = category.managerialGroup?.trim() || NATURE_LABEL[category.nature] || category.nature;
    add(OPERATING_NATURES.has(category.nature) ? operating : outside, label, cents);
    add(byNature, category.nature, cents);
    const groupId = JSON.stringify([category.nature, label]);
    natureGroups.set(groupId, { id: groupId, label, nature: category.nature, cents: (natureGroups.get(groupId)?.cents ?? BigInt(0)) + cents });
    const existing = categoryDetails.get(category.id);
    categoryDetails.set(category.id, { categoryId: category.id, categoryName: category.name, nature: category.nature, group: label, cents: (existing?.cents ?? BigInt(0)) + cents, count: (existing?.count ?? 0) + 1 });
    if (OPERATING_NATURES.has(category.nature) && !category.managerialGroup?.trim()) ungrouped.add(category.id);
    if ((category.nature === "OPERATING_REVENUE" && cents < BigInt(0)) || (["COST", "EXPENSE"].includes(category.nature) && cents > BigInt(0))) unusualSignCount++;
  };

  for (const title of titles) {
    const lines = title.allocations.length > 0
      ? title.allocations.map((allocation) => ({ category: allocation.category, amountCents: allocation.amountCents }))
      : [{ category: title.category, amountCents: title.originalAmountCents }];
    for (const line of lines) {
      record(line.category, title.type === "RECEIVABLE" ? line.amountCents : -line.amountCents);
    }
  }
  for (const purchase of cardPurchases) record(purchase.category, -purchase.amountCents);

  const financial = new Map<string, bigint>();
  for (const settlement of settlements) {
    const receivable = settlement.title.type === "RECEIVABLE";
    if (settlement.interestPenaltyCents > BigInt(0)) {
      add(financial, receivable ? "Juros e multas recebidos" : "Juros e multas pagos", receivable ? settlement.interestPenaltyCents : -settlement.interestPenaltyCents);
    }
    if (settlement.feesCents > BigInt(0)) {
      add(financial, receivable ? "Taxas retidas (maquininha, gateway)" : "Tarifas pagas", -settlement.feesCents);
    }
    if (settlement.discountCents > BigInt(0)) {
      add(financial, receivable ? "Descontos concedidos" : "Descontos obtidos", receivable ? -settlement.discountCents : settlement.discountCents);
    }
  }

  const groups = sortedLines(operating);
  const financialLines = sortedLines(financial);
  const operatingResultCents = sum(groups);
  const financialResultCents = sum(financialLines);
  const revenueCents = byNature.get("OPERATING_REVENUE") ?? BigInt(0);
  const costCents = byNature.get("COST") ?? BigInt(0);
  const expenseCents = byNature.get("EXPENSE") ?? BigInt(0);

  return {
    /** Grupos do resultado operacional (receita, custo e despesa). */
    groups,
    operatingResultCents,
    financialLines,
    financialResultCents,
    /** Resultado do período = operacional + financeiro. */
    totalCents: operatingResultCents + financialResultCents,
    /** Movimentação de capital listada para conferência; não entra no total. */
    outsideResult: sortedLines(outside),
    revenueCents,
    costCents,
    expenseCents,
    grossResultCents: revenueCents + costCents,
    categoryDetails: [...categoryDetails.values()].sort((a, b) => a.nature.localeCompare(b.nature) || a.group.localeCompare(b.group) || a.categoryName.localeCompare(b.categoryName)),
    natureGroups: [...natureGroups.values()],
    ungroupedCategoryCount: ungrouped.size,
    unusualSignCount,
    unclassifiedRefundCents: refunds.reduce((sum, r) => sum + r.amountCents, BigInt(0)),
  };
}
