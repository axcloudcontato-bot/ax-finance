import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { TitleHasActiveSettlementsError, TitleNotFoundError } from "../errors";

export const cancelTitleInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** Seção 6: cancelamento só é permitido quando não há baixa ativa. */
export async function cancelTitle(
  userId: string,
  companyId: string,
  titleId: string,
  input: unknown
) {
  const data = cancelTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) {
      throw new TitleNotFoundError();
    }

    const activeSettlement = await tx.settlement.findFirst({
      where: { titleId, reversedAt: null },
    });
    if (activeSettlement) {
      throw new TitleHasActiveSettlementsError();
    }

    const cancelled = await tx.title.update({
      where: { id: titleId },
      data: { status: "CANCELLED", cancelReason: data.reason },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "TITLE_CANCELLED",
      resourceType: "Title",
      resourceId: titleId,
      summary: data.reason,
      metadata: { titleType: title.type },
    });

    return cancelled;
  });
}
