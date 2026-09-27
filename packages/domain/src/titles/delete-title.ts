import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { TitleNotFoundError } from "../errors";

export const deleteTitleInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Soft delete auditável: o título deixa das telas operacionais, mas sua linha,
 * baixas, conciliações e anexos permanecem preservados para auditoria.
 */
export async function deleteTitle(userId: string, companyId: string, titleId: string, input: unknown) {
  const data = deleteTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({
      where: { id: titleId, companyId, deletedAt: null },
    });
    if (!title) {
      throw new TitleNotFoundError();
    }

    await assertPeriodOpen(tx, companyId, title.competenceDate);

    const settlements = await tx.settlement.findMany({ where: { titleId } });
    for (const settlement of settlements) {
      await assertPeriodOpen(tx, companyId, settlement.effectiveDate);
    }

    await tx.title.update({
      where: { id: titleId },
      data: { deletedAt: new Date(), deletedByUserId: userId, deleteReason: data.reason },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "TITLE_SOFT_DELETED",
      resourceType: "Title",
      resourceId: titleId,
      summary: data.reason,
      metadata: {
        titleType: title.type,
        description: title.description,
        originalAmountCents: title.originalAmountCents.toString(),
        settlementsPreserved: settlements.length,
      },
    });
    return { titleId, settlementsPreserved: settlements.length };
  });
}
