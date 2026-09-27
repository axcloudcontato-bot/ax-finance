import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { assertCompanyPermission } from "../companies/permissions";
import {
  FinancialAccountNotFoundError,
  SettlementAlreadyReversedError,
  SettlementNotFoundError,
  SettlementRefundExceedsCashError,
  SettlementRefundNotFoundError,
} from "../errors";
import { settlementCashDelta } from "./settlement-cash-delta";

const registerRefundInput = z.object({
  financialAccountId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  effectiveDate: z.coerce.date(),
  reason: z.string().trim().min(1).max(500),
});

export async function registerSettlementRefund(userId: string, companyId: string, settlementId: string, input: unknown) {
  const data = registerRefundInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "settlements" WHERE id = ${settlementId} AND company_id = ${companyId} FOR UPDATE
    `;
    if (!locked[0]) throw new SettlementNotFoundError();
    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, companyId }, include: { title: { select: { id: true, type: true } }, refunds: { where: { reversedAt: null } } },
    });
    if (!settlement) throw new SettlementNotFoundError();
    if (settlement.reversedAt) throw new SettlementAlreadyReversedError();
    if (!(await tx.financialAccount.findFirst({ where: { id: data.financialAccountId, companyId, status: "ACTIVE" } }))) {
      throw new FinancialAccountNotFoundError();
    }
    await assertPeriodOpen(tx, companyId, data.effectiveDate);
    const cash = settlementCashDelta(settlement.title.type, settlement);
    const cashAbs = cash < BigInt(0) ? -cash : cash;
    const refunded = settlement.refunds.reduce((sum, item) => sum + item.amountCents, BigInt(0));
    if (refunded + BigInt(data.amountCents) > cashAbs) throw new SettlementRefundExceedsCashError();
    const refund = await tx.settlementRefund.create({ data: {
      companyId, settlementId, financialAccountId: data.financialAccountId, amountCents: BigInt(data.amountCents),
      effectiveDate: data.effectiveDate, reason: data.reason, createdByUserId: userId,
    } });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "SETTLEMENT_REFUND_REGISTERED", resourceType: "Title", resourceId: settlement.title.id,
      summary: data.reason, metadata: { settlementId, refundId: refund.id, amountCents: data.amountCents },
    });
    return refund;
  });
}

const reverseRefundInput = z.object({ reason: z.string().trim().min(1).max(500) });

export async function reverseSettlementRefund(userId: string, companyId: string, refundId: string, input: unknown) {
  const data = reverseRefundInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");
  return withCompanyContext(userId, companyId, async (tx) => {
    const refund = await tx.settlementRefund.findFirst({ where: { id: refundId, companyId }, include: { settlement: true } });
    if (!refund) throw new SettlementRefundNotFoundError();
    if (refund.reversedAt) throw new SettlementAlreadyReversedError();
    await assertPeriodOpen(tx, companyId, refund.effectiveDate);
    const reversed = await tx.settlementRefund.update({ where: { id: refund.id }, data: { reversedAt: new Date(), reversalReason: data.reason } });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "SETTLEMENT_REFUND_REVERSED", resourceType: "Title", resourceId: refund.settlement.titleId,
      summary: data.reason, metadata: { settlementId: refund.settlementId, refundId },
    });
    return reversed;
  });
}
