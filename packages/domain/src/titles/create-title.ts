import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryNotFoundError, CompanyAccessScopeInvalidError, CostCenterNotFoundError, IdempotencyResultUnavailableError, PartyNotFoundError } from "../errors";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";

export const createTitleInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  // Centavos inteiros — nunca float (Seção 18, regra 1).
  originalAmountCents: z.number().int().positive(),
  currency: z.string().length(3).default("BRL"),
  competenceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateTitleInput = z.infer<typeof createTitleInput>;

/**
 * Sem rascunho nesta etapa: todo título já nasce OPEN com os campos
 * obrigatórios da Seção 6 (descrição, valor positivo, competência,
 * vencimento, classificação) validados antes de gravar.
 */
export async function createTitle(userId: string, companyId: string, input: unknown) {
  const data = createTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const { idempotencyKey, ...request } = data;
    const idempotency = await beginIdempotentOperation(tx, {
      companyId,
      operation: "CREATE_TITLE",
      key: idempotencyKey,
      request,
      resourceType: "Title",
    });
    if (idempotency.kind === "replay") {
      const existing = await tx.title.findFirst({ where: { id: idempotency.resourceId, companyId, deletedAt: null } });
      if (!existing) throw new IdempotencyResultUnavailableError();
      return existing;
    }

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

    const membership = await tx.membership.findUniqueOrThrow({ where: { userId_companyId: { userId, companyId } } });
    if (membership.accessScope === "RESTRICTED" && !data.costCenterId) throw new CompanyAccessScopeInvalidError();
    if (data.costCenterId) {
      const costCenter = await tx.costCenter.findFirst({ where: { id: data.costCenterId, companyId, status: "ACTIVE" } });
      if (!costCenter) throw new CostCenterNotFoundError();
    }

    const title = await tx.title.create({
      data: {
        companyId,
        type: data.type,
        description: data.description,
        categoryId: data.categoryId,
        partyId: data.partyId,
        costCenterId: data.costCenterId,
        originalAmountCents: BigInt(data.originalAmountCents),
        currency: data.currency,
        competenceDate: data.competenceDate,
        dueDate: data.dueDate,
        notes: data.notes,
      },
    });
    await completeIdempotentOperation(tx, idempotency, title.id);
    return title;
  });
}
