import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
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
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const transfer = await tx.transfer.findFirst({ where: { id: transferId, companyId } });
    if (!transfer) {
      throw new TransferNotFoundError();
    }
    if (transfer.reversedAt) {
      throw new TransferAlreadyReversedError();
    }

    return tx.transfer.update({
      where: { id: transferId },
      data: { reversedAt: new Date(), reversalReason: data.reason },
    });
  });
}
