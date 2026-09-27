import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryDepthExceededError, CategoryNotFoundError } from "../errors";
import { CATEGORY_NATURES } from "./create-category";

const updateCategoryInput = z.object({
  name: z.string().trim().min(1).max(200), nature: z.enum(CATEGORY_NATURES),
  parentId: z.string().uuid().optional(), managerialGroup: z.string().trim().max(200).optional(),
});

export async function updateCategory(userId: string, companyId: string, categoryId: string, input: unknown) {
  const data = updateCategoryInput.parse(input);
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({ where: { id: categoryId, companyId } });
    if (!category) throw new CategoryNotFoundError();
    if (data.parentId) {
      if (data.parentId === categoryId) throw new CategoryDepthExceededError();
      const parent = await tx.category.findFirst({ where: { id: data.parentId, companyId, status: "ACTIVE" } });
      if (!parent) throw new CategoryNotFoundError();
      if (parent.parentId || await tx.category.findFirst({ where: { companyId, parentId: categoryId } })) throw new CategoryDepthExceededError();
    }
    return tx.category.update({ where: { id: categoryId }, data: { ...data, parentId: data.parentId ?? null, managerialGroup: data.managerialGroup || null } });
  });
}

export async function reactivateCategory(userId: string, companyId: string, categoryId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    if (!(await tx.category.findFirst({ where: { id: categoryId, companyId } }))) throw new CategoryNotFoundError();
    return tx.category.update({ where: { id: categoryId }, data: { status: "ACTIVE" } });
  });
}
