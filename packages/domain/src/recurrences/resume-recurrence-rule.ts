import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { RecurrenceRuleNotFoundError } from "../errors";

export async function resumeRecurrenceRule(userId: string, companyId: string, ruleId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const rule = await tx.recurrenceRule.findFirst({ where: { id: ruleId, companyId } });
    if (!rule) {
      throw new RecurrenceRuleNotFoundError();
    }

    return tx.recurrenceRule.update({ where: { id: ruleId }, data: { status: "ACTIVE" } });
  });
}
