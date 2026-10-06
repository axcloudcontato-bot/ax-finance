import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { NATURE_LABEL } from "../categories/nature-label";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";

export const managerialIncomeStatementInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ManagerialIncomeStatementInput = z.infer<typeof managerialIncomeStatementInput>;

/**
 * DRE gerencial básica (Seção 13): regime de competência, não caixa — usa
 * competenceDate e o valor ORIGINAL do título (não a baixa), incluindo
 * títulos ainda em aberto. Só título cancelado fica de fora (o saldo
 * remanescente cancelado deixou de ser uma obrigação/receita real).
 * Agrupa por managerialGroup da categoria; quando a categoria não tem grupo
 * definido, cai no rótulo da natureza — nenhuma categoria fica de fora do
 * relatório por falta de configuração (versionamento de grupo ao longo do
 * tempo é uma feature maior, fora do escopo do "básica").
 */
export async function getManagerialIncomeStatement(userId: string, companyId: string, input: unknown) {
  const data = managerialIncomeStatementInput.parse(input);
  await assertActiveMembership(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "MANAGERIAL_DRE");

  const range = { gte: new Date(data.from), lte: new Date(data.to) };
  const { titles, cardPurchases } = await withCompanyContext(userId, companyId, async (tx) => ({
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
  }));

  const totalsByGroup = new Map<string, bigint>();
  for (const title of titles) {
    const lines = title.allocations.length > 0
      ? title.allocations.map((allocation) => ({ category: allocation.category, amountCents: allocation.amountCents }))
      : [{ category: title.category, amountCents: title.originalAmountCents }];
    for (const line of lines) {
      const label = line.category.managerialGroup?.trim() || NATURE_LABEL[line.category.nature] || line.category.nature;
      const signedCents = title.type === "RECEIVABLE" ? line.amountCents : -line.amountCents;
      totalsByGroup.set(label, (totalsByGroup.get(label) ?? BigInt(0)) + signedCents);
    }
  }

  for (const purchase of cardPurchases) {
    const label = purchase.category.managerialGroup?.trim() || NATURE_LABEL[purchase.category.nature] || purchase.category.nature;
    totalsByGroup.set(label, (totalsByGroup.get(label) ?? BigInt(0)) - purchase.amountCents);
  }

  const groups = Array.from(totalsByGroup.entries())
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => (b.cents > a.cents ? 1 : b.cents < a.cents ? -1 : 0));

  return {
    groups,
    totalCents: groups.reduce((sum, group) => sum + group.cents, BigInt(0)),
  };
}
