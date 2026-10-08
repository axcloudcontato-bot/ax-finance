import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import {
  CategoryNotFoundError,
  CompanyAccessScopeInvalidError,
  CostCenterNotFoundError,
  PartyNotFoundError,
  TitleAllocationTotalInvalidError,
  TitleAmountBelowSettledError,
  TitleNotFoundError,
} from "../errors";
import { assertTitleNotCardInvoice } from "../credit-cards/invoices";
import { assertExpectedAccount, titleDetailsShape } from "./title-details";

export const updateTitleInput = z.object({
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  originalAmountCents: z.number().int().positive(),
  competenceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  ...titleDetailsShape,
});

export async function updateTitle(userId: string, companyId: string, titleId: string, input: unknown) {
  const data = updateTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({
      where: { id: titleId, companyId, deletedAt: null },
      include: { settlements: { where: { reversedAt: null } }, allocations: true },
    });
    if (!title) throw new TitleNotFoundError();
    await assertTitleNotCardInvoice(tx, companyId, title.id);

    const category = await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE" } });
    if (!category) throw new CategoryNotFoundError();
    await assertExpectedAccount(tx, companyId, data.expectedAccountId);
    if (data.partyId && !(await tx.party.findFirst({ where: { id: data.partyId, companyId, status: "ACTIVE" } }))) {
      throw new PartyNotFoundError();
    }
    const membership = await tx.membership.findUniqueOrThrow({ where: { userId_companyId: { userId, companyId } } });
    if (membership.accessScope === "RESTRICTED" && !data.costCenterId) throw new CompanyAccessScopeInvalidError();
    if (data.costCenterId && !(await tx.costCenter.findFirst({ where: { id: data.costCenterId, companyId, status: "ACTIVE" } }))) {
      throw new CostCenterNotFoundError();
    }

    const settled = title.settlements.reduce((sum, item) => sum + item.principalAmountCents + item.discountCents, BigInt(0));
    if (BigInt(data.originalAmountCents) < settled) throw new TitleAmountBelowSettledError();
    if (title.allocations.length > 0) {
      const allocated = title.allocations.reduce((sum, item) => sum + item.amountCents, BigInt(0));
      if (allocated !== BigInt(data.originalAmountCents)) throw new TitleAllocationTotalInvalidError();
    }

    const updated = await tx.title.update({
      where: { id: title.id },
      data: {
        description: data.description,
        categoryId: data.categoryId,
        partyId: data.partyId ?? null,
        costCenterId: data.costCenterId ?? null,
        originalAmountCents: BigInt(data.originalAmountCents),
        competenceDate: data.competenceDate,
        dueDate: data.dueDate,
        notes: data.notes ?? null,
        // Nos campos operacionais, undefined deixa como está e null (ou texto vazio) limpa.
        expectedAccountId: data.expectedAccountId === undefined ? undefined : data.expectedAccountId || null,
        documentNumber: data.documentNumber === undefined ? undefined : data.documentNumber || null,
        expectedPaymentMethod: data.expectedPaymentMethod === undefined ? undefined : data.expectedPaymentMethod || null,
        paymentCode: data.paymentCode === undefined ? undefined : data.paymentCode || null,
        status: title.status === "CANCELLED" ? "CANCELLED" : settled === BigInt(0) ? "OPEN" : settled >= BigInt(data.originalAmountCents) ? "SETTLED" : "PARTIALLY_SETTLED",
      },
    });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "TITLE_UPDATED", resourceType: "Title", resourceId: title.id,
      summary: "Título editado", metadata: { previousAmountCents: title.originalAmountCents.toString(), newAmountCents: data.originalAmountCents },
    });
    return updated;
  });
}
