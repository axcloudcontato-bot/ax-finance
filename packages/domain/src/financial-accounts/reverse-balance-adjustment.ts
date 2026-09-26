import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { BalanceAdjustmentAlreadyReversedError, BalanceAdjustmentNotFoundError } from "../errors";

export const reverseBalanceAdjustmentInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** Estorno técnico: nunca apaga o ajuste original (mesma regra de settlement/transfer). */
export async function reverseBalanceAdjustment(
  userId: string,
  companyId: string,
  adjustmentId: string,
  input: unknown
) {
  const data = reverseBalanceAdjustmentInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const adjustment = await tx.balanceAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
    });
    if (!adjustment) {
      throw new BalanceAdjustmentNotFoundError();
    }
    if (adjustment.reversedAt) {
      throw new BalanceAdjustmentAlreadyReversedError();
    }

    await assertPeriodOpen(tx, companyId, adjustment.effectiveDate);

    const reversed = await tx.balanceAdjustment.update({
      where: { id: adjustmentId },
      data: { reversedAt: new Date(), reversalReason: data.reason },
    });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "BALANCE_ADJUSTMENT_REVERSED",
      resourceType: "FinancialAccount",
      resourceId: adjustment.financialAccountId,
      summary: data.reason,
      metadata: { adjustmentId, amountCents: adjustment.amountCents.toString() },
    });

    return reversed;
  });
}
