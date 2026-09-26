import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { CategoryDepthExceededError, CategoryNotFoundError } from "../errors";

export const CATEGORY_NATURES = [
  "OPERATING_REVENUE",
  "COST",
  "EXPENSE",
  "INVESTMENT",
  "FINANCING",
  "EQUITY",
  "TECHNICAL_TRANSFER",
] as const;

export const createCategoryInput = z.object({
  name: z.string().trim().min(1).max(200),
  nature: z.enum(CATEGORY_NATURES),
  parentId: z.string().uuid().optional(),
  managerialGroup: z.string().trim().max(200).optional(),
  color: z.string().trim().max(20).optional(),
  order: z.number().int().default(0),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInput>;

/**
 * Seção 9: modelo P0 tem só dois níveis (categoria/subcategoria) e o filho
 * precisa pertencer à mesma empresa do pai — por isso a checagem do pai
 * acontece dentro do mesmo contexto de empresa, não como uma leitura solta.
 */
export async function createCategory(userId: string, companyId: string, input: unknown) {
  const data = createCategoryInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    if (data.parentId) {
      const parent = await tx.category.findFirst({
        where: { id: data.parentId, companyId },
      });
      if (!parent) {
        throw new CategoryNotFoundError();
      }
      if (parent.parentId) {
        throw new CategoryDepthExceededError();
      }
    }

    return tx.category.create({
      data: {
        companyId,
        name: data.name,
        nature: data.nature,
        parentId: data.parentId,
        managerialGroup: data.managerialGroup,
        color: data.color,
        order: data.order,
      },
    });
  });
}
