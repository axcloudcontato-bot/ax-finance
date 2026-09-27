import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import {
  CategoryNotFoundError,
  InstallmentAmountTooSmallError,
  InstallmentCountInvalidError,
  PartyNotFoundError,
} from "../errors";
import { addMonthsClamped } from "./installment-dates";

export const createInstallmentPlanInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  totalAmountCents: z.number().int().positive(),
  installmentCount: z.number().int(),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  intervalMonths: z.number().int().min(1).default(1),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateInstallmentPlanInput = z.infer<typeof createInstallmentPlanInput>;

/**
 * Seção 11: parcelamento é uma obrigação/receita original dividida em N
 * títulos, gerados de uma vez (diferente de recorrência, que gera títulos ao
 * longo do tempo por um motor próprio — não existe aqui ainda). Centavos
 * residuais da divisão vão para as primeiras parcelas (R$100/3 = 33,34 +
 * 33,33 + 33,33, exemplo exato da Seção 11), e os vencimentos usam
 * addMonthsClamped para não arrastar o clamp de fim de mês entre parcelas.
 */
export async function createInstallmentPlan(userId: string, companyId: string, input: unknown) {
  const data = createInstallmentPlanInput.parse(input);
  if (data.installmentCount < 2) {
    throw new InstallmentCountInvalidError();
  }
  if (data.totalAmountCents < data.installmentCount) {
    throw new InstallmentAmountTooSmallError();
  }
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  const baseCents = Math.floor(data.totalAmountCents / data.installmentCount);
  const remainderCents = data.totalAmountCents - baseCents * data.installmentCount;
  const installmentGroupId = randomUUID();

  return withCompanyContext(userId, companyId, async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: data.categoryId, companyId, status: "ACTIVE" },
    });
    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (data.partyId) {
      const party = await tx.party.findFirst({
        where: { id: data.partyId, companyId, status: "ACTIVE" },
      });
      if (!party) {
        throw new PartyNotFoundError();
      }
    }

    const titles = [];
    for (let index = 0; index < data.installmentCount; index++) {
      const amountCents = baseCents + (index < remainderCents ? 1 : 0);
      const dueDate = new Date(addMonthsClamped(data.firstDueDate, index * data.intervalMonths));

      const title = await tx.title.create({
        data: {
          companyId,
          type: data.type,
          description: data.description,
          categoryId: data.categoryId,
          partyId: data.partyId,
          originalAmountCents: BigInt(amountCents),
          competenceDate: dueDate,
          dueDate,
          notes: data.notes,
          installmentGroupId,
          installmentNumber: index + 1,
          installmentCount: data.installmentCount,
        },
      });
      titles.push(title);
    }

    return titles;
  });
}
