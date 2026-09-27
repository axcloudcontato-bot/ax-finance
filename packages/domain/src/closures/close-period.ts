import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";

export const closePeriodInput = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * Um único row por (companyId, period): fechar de novo depois de reaberto
 * faz update no mesmo row. O histórico completo de quantas vezes um período
 * foi fechado/reaberto fica na trilha de auditoria, não aqui.
 */
export async function closePeriod(userId: string, companyId: string, input: unknown) {
  const data = closePeriodInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CLOSING");

  return withCompanyContext(userId, companyId, async (tx) => {
    const closure = await tx.periodClosure.upsert({
      where: { companyId_period: { companyId, period: data.period } },
      create: {
        companyId,
        period: data.period,
        status: "CLOSED",
        closedByUserId: userId,
      },
      update: {
        status: "CLOSED",
        closedByUserId: userId,
        closedAt: new Date(),
        reopenedByUserId: null,
        reopenedAt: null,
        reopenReason: null,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "PERIOD_CLOSED",
      resourceType: "Period",
      resourceId: data.period,
      summary: `Período ${data.period} fechado`,
    });

    return closure;
  });
}
