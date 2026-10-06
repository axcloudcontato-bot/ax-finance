import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { PartyNotFoundError } from "../errors";
import { getCompanyToday } from "../shared/today";

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getParty(userId: string, companyId: string, partyId: string) {
  await assertActiveMembership(userId, companyId);

  const party = await withCompanyContext(userId, companyId, (tx) =>
    tx.party.findFirst({ where: { id: partyId, companyId } })
  );
  if (!party) {
    throw new PartyNotFoundError();
  }

  const rawTitles = await withCompanyContext(userId, companyId, (tx) =>
    tx.title.findMany({
      where: { companyId, partyId, deletedAt: null },
      include: { settlements: { where: { reversedAt: null } } },
      orderBy: { dueDate: "asc" },
    })
  );

  const today = await getCompanyToday(userId, companyId);

  const titles = rawTitles.map(({ settlements, ...title }) => {
    const settledPrincipalEquivalent = settlements.reduce(
      (sum, settlement) => sum + settlement.principalAmountCents + settlement.discountCents,
      BigInt(0)
    );
    const remainingCents = title.originalAmountCents - settledPrincipalEquivalent;
    const isOpen = title.status === "OPEN" || title.status === "PARTIALLY_SETTLED";
    return {
      ...title,
      remainingCents,
      overdue: isOpen && remainingCents > BigInt(0) && toDateOnlyString(title.dueDate) < today,
    };
  });

  const openTitles = titles.filter(
    (title) => (title.status === "OPEN" || title.status === "PARTIALLY_SETTLED") && title.remainingCents > BigInt(0)
  );

  return {
    party,
    titles,
    openTotalCents: openTitles.reduce((sum, title) => sum + title.remainingCents, BigInt(0)),
    overdueTotalCents: openTitles
      .filter((title) => title.overdue)
      .reduce((sum, title) => sum + title.remainingCents, BigInt(0)),
    overdueCount: openTitles.filter((title) => title.overdue).length,
  };
}
