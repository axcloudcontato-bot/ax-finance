import { z } from "zod";
import { lockPeriodClosure } from "../closures/assert-period-open";
import { lockTitles } from "../titles/lock-titles";
import { recordAuditEvent } from "../audit/record-audit-event";
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
      await lockPeriodClosure(tx, companyId, true);
      const candidates = await tx.title.findMany({ where: { companyId, recurrenceRuleId: ruleId, deletedAt: null, status: "OPEN" }, select: { id: true } });
      await lockTitles(tx, companyId, candidates.map((title) => title.id));
      const closed = new Set((await tx.periodClosure.findMany({ where: { companyId, status: "CLOSED" }, select: { period: true } })).map((period) => period.period));
      const titles = await tx.title.findMany({ where: { companyId, recurrenceRuleId: ruleId, deletedAt: null, status: "OPEN", settlements: { none: { reversedAt: null } } }, select: { id: true, competenceDate: true } });
      const openIds = titles.filter((title) => !closed.has(title.competenceDate.toISOString().slice(0, 7))).map((title) => title.id);
      await tx.title.updateMany({
        where: {
          companyId,
          id: { in: openIds },
          recurrenceRuleId: ruleId,
          status: "OPEN",
          settlements: { none: { reversedAt: null } },
        },
        data: { status: "CANCELLED", cancelReason: data.reason },
      });
      for (const id of openIds) await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_CANCELLED", resourceType: "Title", resourceId: id, summary: data.reason, metadata: { recurrenceRuleId: ruleId } });
    }

    return updatedRule;
  });
}
