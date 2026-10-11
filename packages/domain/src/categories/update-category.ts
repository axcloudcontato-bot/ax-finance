import { z } from "zod";
import { assertPeriodOpen, lockPeriodClosure } from "../closures/assert-period-open";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryDepthExceededError, CategoryNotFoundError } from "../errors";
import { CATEGORY_NATURES } from "./create-category";
import { recordAuditEvent } from "../audit/record-audit-event";

const updateCategoryInput = z.object({
  costBehavior: z.enum(["UNCLASSIFIED", "FIXED", "VARIABLE"]).optional(),
  name: z.string().trim().min(1).max(200), nature: z.enum(CATEGORY_NATURES),
  parentId: z.string().uuid().optional(), managerialGroup: z.string().trim().max(200).optional(),
});

export async function updateCategory(userId: string, companyId: string, categoryId: string, input: unknown) {
  const data = updateCategoryInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    await lockPeriodClosure(tx, companyId, true);
    const category = await tx.category.findFirst({ where: { id: categoryId, companyId } });
    if (!category) throw new CategoryNotFoundError();
    if (data.nature !== category.nature || (data.managerialGroup?.trim() || null) !== category.managerialGroup || (data.costBehavior !== undefined && data.costBehavior !== category.costBehavior)) {
      // A natureza e o grupo são usados nos relatórios de títulos, rateios e compras já lançados.
      const [titles, purchases] = await Promise.all([
        tx.title.findMany({ where: { companyId, deletedAt: null, status: { not: "CANCELLED" }, OR: [{ categoryId }, { allocations: { some: { categoryId } } }] }, select: { competenceDate: true } }),
        tx.creditCardPurchase.findMany({ where: { companyId, categoryId, canceledAt: null }, select: { competenceDate: true } }),
      ]);
      const months = new Map([...titles, ...purchases].map((item) => [item.competenceDate.toISOString().slice(0, 7), item.competenceDate]));
      for (const date of months.values()) await assertPeriodOpen(tx, companyId, date);
    }
    if (data.parentId) {
      if (data.parentId === categoryId) throw new CategoryDepthExceededError();
      const parent = await tx.category.findFirst({ where: { id: data.parentId, companyId, status: "ACTIVE" } });
      if (!parent) throw new CategoryNotFoundError();
      if (parent.parentId || await tx.category.findFirst({ where: { companyId, parentId: categoryId } })) throw new CategoryDepthExceededError();
    }
    const updated = await tx.category.update({ where: { id: categoryId }, data: { ...data, parentId: data.parentId ?? null, managerialGroup: data.managerialGroup || null } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CATEGORY_UPDATED", resourceType: "Category", resourceId: categoryId, summary: `Categoria ${updated.name} atualizada`, metadata: { previousCostBehavior: category.costBehavior, costBehavior: updated.costBehavior, previousNature: category.nature, nature: updated.nature } });
    return updated;
  });
}

export async function reactivateCategory(userId: string, companyId: string, categoryId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    if (!(await tx.category.findFirst({ where: { id: categoryId, companyId } }))) throw new CategoryNotFoundError();
    return tx.category.update({ where: { id: categoryId }, data: { status: "ACTIVE" } });
  });
}
