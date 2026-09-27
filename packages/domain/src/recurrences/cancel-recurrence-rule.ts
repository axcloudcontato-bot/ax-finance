import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { RecurrenceRuleNotFoundError } from "../errors";

export const cancelRecurrenceRuleInput = z.object({
  reason: z.string().trim().min(1).max(500),
  alsoCancelOpenTitles: z.boolean().default(false),
});

/**
 * Seção 11: cancelar a regra sempre impede geração futura (igual pausar,
 * mas sem volta). Cancelar os títulos já gerados que ainda estão em aberto
 * é uma decisão explícita à parte (alsoCancelOpenTitles) — títulos com baixa
 * ativa ou já fechados nunca são tocados.
 */
export async function cancelRecurrenceRule(userId: string, companyId: string, ruleId: string, input: unknown) {
  const data = cancelRecurrenceRuleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const rule = await tx.recurrenceRule.findFirst({ where: { id: ruleId, companyId } });
    if (!rule) {
      throw new RecurrenceRuleNotFoundError();
    }

    const updatedRule = await tx.recurrenceRule.update({
      where: { id: ruleId },
      data: { status: "CANCELLED" },
    });

    if (data.alsoCancelOpenTitles) {
      await tx.title.updateMany({
        where: {
          companyId,
          recurrenceRuleId: ruleId,
          status: "OPEN",
          settlements: { none: { reversedAt: null } },
        },
        data: { status: "CANCELLED", cancelReason: data.reason },
      });
    }

    return updatedRule;
  });
}
