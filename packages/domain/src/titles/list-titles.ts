import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListTitlesFilter {
  type?: "RECEIVABLE" | "PAYABLE";
}

/**
 * "Vencido" não é um status gravado — é calculado na leitura a partir do
 * vencimento e do saldo aberto (Seção 6: não gravar estado vencido que
 * dependa de atualização manual diária). Por isso devolvemos remainingCents
 * já calculado, e a página decide o rótulo (vencido/hoje/próximas/pagas).
 */
export async function listTitles(
  userId: string,
  companyId: string,
  filter: ListTitlesFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: { companyId, deletedAt: null, ...(filter.type ? { type: filter.type } : {}) },
      include: {
        category: true,
        party: true,
        costCenter: true,
        settlements: { where: { reversedAt: null } },
      },
      orderBy: { dueDate: "asc" },
    })
  );

  return titles.map(({ settlements, ...title }) => {
    const settledPrincipalEquivalent = settlements.reduce(
      (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
      BigInt(0)
    );
    return {
      ...title,
      remainingCents: title.originalAmountCents - settledPrincipalEquivalent,
    };
  });
}
