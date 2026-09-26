import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { RecurrenceRuleNotFoundError } from "../errors";

export async function resumeRecurrenceRule(userId: string, companyId: string, ruleId: string) {
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const rule = await tx.recurrenceRule.findFirst({ where: { id: ruleId, companyId } });
    if (!rule) {
      throw new RecurrenceRuleNotFoundError();
    }

    return tx.recurrenceRule.update({ where: { id: ruleId }, data: { status: "ACTIVE" } });
  });
}
