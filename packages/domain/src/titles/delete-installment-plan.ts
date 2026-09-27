import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { InstallmentGroupNotFoundError } from "../errors";

export const deleteInstallmentPlanInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Soft delete em massa: preserva parcelas, baixas, conciliações e anexos.
 */
export async function deleteInstallmentPlan(
  userId: string,
  companyId: string,
  installmentGroupId: string,
  input: unknown
) {
  const data = deleteInstallmentPlanInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const titles = await tx.title.findMany({
      where: { companyId, installmentGroupId, deletedAt: null },
    });
    if (titles.length === 0) {
      throw new InstallmentGroupNotFoundError();
    }

    const titleIds = titles.map((t) => t.id);
    const settlements = await tx.settlement.findMany({ where: { titleId: { in: titleIds } } });

    for (const title of titles) {
      await assertPeriodOpen(tx, companyId, title.competenceDate);
    }
    for (const settlement of settlements) {
      await assertPeriodOpen(tx, companyId, settlement.effectiveDate);
    }

    await tx.title.updateMany({
      where: { id: { in: titleIds } },
      data: { deletedAt: new Date(), deletedByUserId: userId, deleteReason: data.reason },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "INSTALLMENT_PLAN_SOFT_DELETED",
      resourceType: "InstallmentGroup",
      resourceId: installmentGroupId,
      summary: data.reason,
      metadata: {
        titleType: titles[0]!.type,
        installmentCount: titles.length,
        settlementsPreserved: settlements.length,
      },
    });

    return {
      deletedCount: titles.length,
      settlementsPreserved: settlements.length,
    };
  });
}
