import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { PeriodClosureNotFoundError } from "../errors";

export const reopenPeriodInput = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().trim().min(1).max(500),
});

/** Seção 18 regra 8: "reabertura exige autorização e motivo" — o motivo fica no evento de auditoria. */
export async function reopenPeriod(userId: string, companyId: string, input: unknown) {
  const data = reopenPeriodInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CLOSING");

  return withCompanyContext(userId, companyId, async (tx) => {
    const existing = await tx.periodClosure.findUnique({
      where: { companyId_period: { companyId, period: data.period } },
    });
    if (!existing || existing.status !== "CLOSED") {
      throw new PeriodClosureNotFoundError();
    }

    const closure = await tx.periodClosure.update({
      where: { companyId_period: { companyId, period: data.period } },
      data: {
        status: "REOPENED",
        reopenedByUserId: userId,
        reopenedAt: new Date(),
        reopenReason: data.reason,
      },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "PERIOD_REOPENED",
      resourceType: "Period",
      resourceId: data.period,
      summary: data.reason,
    });

    return closure;
  });
}
