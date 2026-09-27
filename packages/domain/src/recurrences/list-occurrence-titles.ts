import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listOccurrenceTitles(userId: string, companyId: string, recurrenceRuleId: string) {
  await assertActiveMembership(userId, companyId);

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: { companyId, recurrenceRuleId, deletedAt: null },
      include: { settlements: { where: { reversedAt: null } } },
      orderBy: { recurrenceOccurrenceDate: "asc" },
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
