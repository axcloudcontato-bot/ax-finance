import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { RecurrenceRuleNotFoundError } from "../errors";

/** Seção 11: pausar impede geração futura, mas não apaga obrigações existentes. */
export async function pauseRecurrenceRule(userId: string, companyId: string, ruleId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const rule = await tx.recurrenceRule.findFirst({ where: { id: ruleId, companyId } });
    if (!rule) {
      throw new RecurrenceRuleNotFoundError();
    }

    return tx.recurrenceRule.update({ where: { id: ruleId }, data: { status: "PAUSED" } });
  });
}
