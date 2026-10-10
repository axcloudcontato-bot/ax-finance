import { z } from "zod";
import { assertPeriodOpen } from "../closures/assert-period-open";
import { assertTitleNotDebtInstallment } from "../wealth/debt-installments";
import { lockTitles } from "./lock-titles";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { TitleNotFoundError } from "../errors";
import { assertTitleNotCardInvoice } from "../credit-cards/invoices";

const duplicateTitleInput = z.object({
  competenceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export async function duplicateTitle(userId: string, companyId: string, titleId: string, input: unknown = {}) {
  const data = duplicateTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    await lockTitles(tx, companyId, [titleId]);
    const source = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!source) throw new TitleNotFoundError();
    await assertTitleNotCardInvoice(tx, companyId, source.id);
    await assertTitleNotDebtInstallment(tx, companyId, source.installmentGroupId);
    await assertPeriodOpen(tx, companyId, data.competenceDate ?? source.competenceDate);
    const duplicate = await tx.title.create({
      data: {
        companyId, type: source.type, description: `${source.description} (cópia)`, categoryId: source.categoryId,
        partyId: source.partyId, costCenterId: source.costCenterId, originalAmountCents: source.originalAmountCents,
        currency: source.currency, competenceDate: data.competenceDate ?? source.competenceDate,
        dueDate: data.dueDate ?? source.dueDate, notes: source.notes,
        expectedAccountId: source.expectedAccountId, expectedPaymentMethod: source.expectedPaymentMethod,
      },
    });
    const allocations = await tx.titleAllocation.findMany({ where: { companyId, titleId: source.id } });
    if (allocations.length) await tx.titleAllocation.createMany({ data: allocations.map((item) => ({
      companyId, titleId: duplicate.id, categoryId: item.categoryId, costCenterId: item.costCenterId, amountCents: item.amountCents,
    })) });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "TITLE_DUPLICATED", resourceType: "Title", resourceId: duplicate.id,
      summary: `Duplicado de ${source.description}`, metadata: { sourceTitleId: source.id },
    });
    return duplicate;
  });
}
