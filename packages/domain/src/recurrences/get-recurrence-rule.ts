import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { RecurrenceRuleNotFoundError } from "../errors";

export async function getRecurrenceRule(userId: string, companyId: string, ruleId: string) {
  await assertActiveMembership(userId, companyId);

  const rule = await withCompanyContext(userId, companyId, (tx) =>
    tx.recurrenceRule.findFirst({
      where: { id: ruleId, companyId },
      include: { category: true, party: true },
    })
  );

  if (!rule) {
    throw new RecurrenceRuleNotFoundError();
  }

  return rule;
}
