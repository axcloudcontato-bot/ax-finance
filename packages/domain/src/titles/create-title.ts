import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { CategoryNotFoundError, CompanyAccessScopeInvalidError, CostCenterNotFoundError, IdempotencyResultUnavailableError, PartyNotFoundError, PossibleDuplicateTitleError } from "../errors";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import { assertExpectedAccount, titleDetailsShape } from "./title-details";

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
  ...titleDetailsShape,
  /**
   * Avisa antes de gravar um lançamento parecido com um existente (mesmo valor, vencimento até 7 dias de
   * diferença e mesma pessoa ou mesma descrição). Desligado por padrão: quem lança em série (lote,
   * recorrência) não quer ser interrompido; as telas ligam e deixam a pessoa confirmar.
   */
  checkDuplicates: z.boolean().optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateTitleInput = z.infer<typeof createTitleInput>;

const DUPLICATE_WINDOW_DAYS = 7;

/**
 * Sem rascunho nesta etapa: todo título já nasce OPEN com os campos
 * obrigatórios da Seção 6 (descrição, valor positivo, competência,
 * vencimento, classificação) validados antes de gravar.
 */
export async function createTitle(userId: string, companyId: string, input: unknown) {
  const data = createTitleInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    const { idempotencyKey, checkDuplicates, ...request } = data;
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

    const title = await insertTitleInTx(tx, userId, companyId, { ...request, checkDuplicates });
    await completeIdempotentOperation(tx, idempotency, title.id);
    return title;
  });
}

/**
 * Valida categoria, pessoa, centro de custo e conta prevista e grava o título, dentro de uma transação
 * já aberta (o lançamento a partir de uma linha de extrato cria, baixa e concilia na mesma transação).
 */
export async function insertTitleInTx(tx: TenantScopedClient, userId: string, companyId: string, data: Omit<CreateTitleInput, "idempotencyKey">) {
  const { checkDuplicates } = data;
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

  await assertExpectedAccount(tx, companyId, data.expectedAccountId);

  if (checkDuplicates) {
    const windowMs = DUPLICATE_WINDOW_DAYS * 86_400_000;
    const matches = await tx.title.findMany({
      where: {
        companyId,
        type: data.type,
        deletedAt: null,
        status: { not: "CANCELLED" },
        creditCardInvoice: null,
        originalAmountCents: BigInt(data.originalAmountCents),
        dueDate: { gte: new Date(data.dueDate.getTime() - windowMs), lte: new Date(data.dueDate.getTime() + windowMs) },
        ...(data.partyId ? { partyId: data.partyId } : { description: { equals: data.description, mode: "insensitive" } }),
      },
      select: { id: true, description: true, dueDate: true, originalAmountCents: true },
      orderBy: { dueDate: "asc" },
      take: 3,
    });
    if (matches.length > 0) throw new PossibleDuplicateTitleError(matches);
  }

  const title = await tx.title.create({
    data: {
      companyId,
      type: data.type,
      expectedAccountId: data.expectedAccountId || null,
      documentNumber: data.documentNumber || null,
      expectedPaymentMethod: data.expectedPaymentMethod || null,
      paymentCode: data.paymentCode || null,
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
  return title;
}
