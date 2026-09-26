import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { CategoryNotFoundError } from "../errors";

export const createTitleInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  // Centavos inteiros — nunca float (Seção 18, regra 1).
  originalAmountCents: z.number().int().positive(),
  currency: z.string().length(3).default("BRL"),
  competenceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateTitleInput = z.infer<typeof createTitleInput>;

/**
 * Sem rascunho nesta etapa: todo título já nasce OPEN com os campos
 * obrigatórios da Seção 6 (descrição, valor positivo, competência,
 * vencimento, classificação) validados antes de gravar.
 */
export async function createTitle(userId: string, companyId: string, input: unknown) {
  const data = createTitleInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: data.categoryId, companyId, status: "ACTIVE" },
    });
    if (!category) {
      throw new CategoryNotFoundError();
    }

    return tx.title.create({
      data: {
        companyId,
        type: data.type,
        description: data.description,
        categoryId: data.categoryId,
        originalAmountCents: BigInt(data.originalAmountCents),
        currency: data.currency,
        competenceDate: data.competenceDate,
        dueDate: data.dueDate,
        notes: data.notes,
      },
    });
  });
}
