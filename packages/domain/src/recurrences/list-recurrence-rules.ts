import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";

export interface ListRecurrenceRulesFilter {
  type?: "RECEIVABLE" | "PAYABLE";
}

export async function listRecurrenceRules(
  userId: string,
  companyId: string,
  filter: ListRecurrenceRulesFilter = {}
) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, (tx) =>
    tx.recurrenceRule.findMany({
      where: { companyId, ...(filter.type ? { type: filter.type } : {}) },
      include: { category: true, party: true },
      orderBy: { createdAt: "desc" },
    })
  );
}
