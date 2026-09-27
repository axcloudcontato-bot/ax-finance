import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { TransferAlreadyReversedError, TransferNotFoundError } from "../errors";

export const reverseTransferInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** Estorno soft — nunca apaga a transferência original (Seção 18 regra 10). */
export async function reverseTransfer(
  userId: string,
  companyId: string,
  transferId: string,
  input: unknown
) {
  const data = reverseTransferInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    const transfer = await tx.transfer.findFirst({ where: { id: transferId, companyId } });
    if (!transfer) {
      throw new TransferNotFoundError();
    }
    if (transfer.reversedAt) {
      throw new TransferAlreadyReversedError();
    }

    const reversed = await tx.transfer.update({
      where: { id: transferId },
      data: { reversedAt: new Date(), reversalReason: data.reason },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "TRANSFER_REVERSED",
      resourceType: "Transfer",
      resourceId: transferId,
      summary: data.reason,
    });

    return reversed;
  });
}
