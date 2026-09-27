import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryNotFoundError, PartyNotFoundError, RecurrenceEndDateBeforeStartError } from "../errors";

export const createRecurrenceRuleInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  amountCents: z.number().int().positive(),
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateRecurrenceRuleInput = z.infer<typeof createRecurrenceRuleInput>;

/**
 * Seção 11: recorrência é uma regra viva (diferente de parcelamento, que
 * gera tudo de uma vez e não guarda estado). Esta função só cria a regra —
 * a materialização dos títulos acontece em generateDueOccurrences.
 */
export async function createRecurrenceRule(userId: string, companyId: string, input: unknown) {
  const data = createRecurrenceRuleInput.parse(input);
  if (data.endDate && data.endDate < data.startDate) {
    throw new RecurrenceEndDateBeforeStartError();
  }
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

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

    return tx.recurrenceRule.create({
      data: {
        companyId,
        type: data.type,
        description: data.description,
        categoryId: data.categoryId,
        partyId: data.partyId,
        amountCents: BigInt(data.amountCents),
        dayOfMonth: data.dayOfMonth,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
      },
    });
  });
}
