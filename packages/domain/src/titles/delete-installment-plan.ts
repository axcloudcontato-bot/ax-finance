import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { recordAuditEvent } from "../audit/record-audit-event";
import { InstallmentGroupNotFoundError } from "../errors";

export const deleteInstallmentPlanInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Exclusão em massa de todas as parcelas de um parcelamento (mesma lógica
 * de `deleteTitle`, repetida por parcela) — a pedido explícito do usuário,
 * mesmo parcelas já com baixa.
 */
export async function deleteInstallmentPlan(
  userId: string,
  companyId: string,
  installmentGroupId: string,
  input: unknown
) {
  const data = deleteInstallmentPlanInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const titles = await tx.title.findMany({ where: { companyId, installmentGroupId } });
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

    if (settlements.length > 0) {
      await tx.bankStatementLine.updateMany({
        where: { reconciledSettlementId: { in: settlements.map((s) => s.id) } },
        data: { reconciledSettlementId: null, status: "PENDING" },
      });
      await tx.settlement.deleteMany({ where: { titleId: { in: titleIds } } });
    }

    await tx.title.deleteMany({ where: { id: { in: titleIds } } });

    await recordAuditEvent(tx, {
      companyId,
      actorUserId: userId,
      eventType: "INSTALLMENT_PLAN_DELETED",
      resourceType: "InstallmentGroup",
      resourceId: installmentGroupId,
      summary: data.reason,
      metadata: {
        titleType: titles[0]!.type,
        installmentCount: titles.length,
        settlementsDeleted: settlements.length,
      },
    });

    return { deletedCount: titles.length };
  });
}
