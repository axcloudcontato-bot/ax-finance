import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { TitleNotFoundError } from "../errors";

export async function getTitle(userId: string, companyId: string, titleId: string) {
  await assertActiveMembership(userId, companyId);

  const title = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findFirst({
      where: { id: titleId, companyId, deletedAt: null },
      include: {
        category: true,
        party: true,
        costCenter: true,
        recurrenceRule: { select: { id: true, description: true } },
        settlements: {
          orderBy: { createdAt: "asc" },
          include: { financialAccount: true, refunds: { include: { financialAccount: true }, orderBy: { createdAt: "asc" } } },
        },
        allocations: { include: { category: true, costCenter: true }, orderBy: { createdAt: "asc" } },
      },
    })
  );

  if (!title) {
    throw new TitleNotFoundError();
  }

  const settledPrincipalEquivalent = title.settlements
    .filter((settlement) => !settlement.reversedAt)
    .reduce((sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents, BigInt(0));

  return {
    ...title,
    remainingCents: title.originalAmountCents - settledPrincipalEquivalent,
  };
}
