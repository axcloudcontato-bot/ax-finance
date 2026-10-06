import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { recordAuditEvent } from "../audit/record-audit-event";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryNotFoundError, CostCenterNotFoundError, TitleAllocationTotalInvalidError, TitleNotFoundError } from "../errors";
import { assertTitleNotCardInvoice } from "../credit-cards/invoices";

export const replaceTitleAllocationsInput = z.object({
  allocations: z.array(z.object({
    categoryId: z.string().uuid(),
    costCenterId: z.string().uuid().optional(),
    amountCents: z.number().int().positive(),
  })).min(2).max(50),
});

export async function replaceTitleAllocations(userId: string, companyId: string, titleId: string, input: unknown) {
  const data = replaceTitleAllocationsInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) throw new TitleNotFoundError();
    await assertTitleNotCardInvoice(tx, companyId, title.id);
    const total = data.allocations.reduce((sum, item) => sum + BigInt(item.amountCents), BigInt(0));
    if (total !== title.originalAmountCents) throw new TitleAllocationTotalInvalidError();
    for (const item of data.allocations) {
      if (!(await tx.category.findFirst({ where: { id: item.categoryId, companyId, status: "ACTIVE" } }))) throw new CategoryNotFoundError();
      if (item.costCenterId && !(await tx.costCenter.findFirst({ where: { id: item.costCenterId, companyId, status: "ACTIVE" } }))) throw new CostCenterNotFoundError();
    }
    await tx.titleAllocation.deleteMany({ where: { companyId, titleId } });
    await tx.titleAllocation.createMany({ data: data.allocations.map((item) => ({
      companyId, titleId, categoryId: item.categoryId, costCenterId: item.costCenterId, amountCents: BigInt(item.amountCents),
    })) });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "TITLE_ALLOCATED", resourceType: "Title", resourceId: titleId,
      summary: `Rateio atualizado (${data.allocations.length} itens)`,
    });
    return tx.titleAllocation.findMany({ where: { companyId, titleId }, include: { category: true, costCenter: true } });
  });
}

export async function clearTitleAllocations(userId: string, companyId: string, titleId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const title = await tx.title.findFirst({ where: { id: titleId, companyId, deletedAt: null } });
    if (!title) throw new TitleNotFoundError();
    await assertTitleNotCardInvoice(tx, companyId, title.id);
    await tx.titleAllocation.deleteMany({ where: { companyId, titleId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "TITLE_ALLOCATION_CLEARED", resourceType: "Title", resourceId: titleId, summary: "Rateio removido" });
  });
}
