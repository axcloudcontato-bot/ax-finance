import { z } from "zod";
import { lockPeriodClosure } from "./assert-period-open";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPlanFeature } from "../subscriptions/plan-features";
import { assertFullReportAccess, captureReportSnapshotInTx } from "../reports/report-snapshots";

export const closePeriodInput = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/**
 * Um único row por (companyId, period): fechar de novo depois de reaberto
 * faz update no mesmo row. Cada novo fechamento preserva outra versão imutável
 * do relatório e da carteira, além da trilha de auditoria.
 */
export async function closePeriod(userId: string, companyId: string, input: unknown) {
  const data = closePeriodInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CLOSING");
  await assertFullReportAccess(userId, companyId);
  await assertCompanyPlanFeature(userId, companyId, "PERIOD_CLOSING");

  return withCompanyContext(userId, companyId, async (tx) => {
    await lockPeriodClosure(tx, companyId);
    const existing = await tx.periodClosure.findUnique({ where: { companyId_period: { companyId, period: data.period } } });
    const previousSnapshot = await tx.reportSnapshot.findFirst({ where: { companyId, period: data.period, kind: "CLOSING" } });
    if (existing?.status === "CLOSED" && previousSnapshot) return existing;
    await captureReportSnapshotInTx(tx, userId, companyId, data.period, "CLOSING");
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
