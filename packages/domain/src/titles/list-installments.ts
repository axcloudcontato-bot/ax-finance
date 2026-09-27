import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export async function listInstallments(userId: string, companyId: string, installmentGroupId: string) {
  await assertActiveMembership(userId, companyId);

  const titles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: { companyId, installmentGroupId, deletedAt: null },
      include: { settlements: { where: { reversedAt: null } } },
      orderBy: { installmentNumber: "asc" },
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
