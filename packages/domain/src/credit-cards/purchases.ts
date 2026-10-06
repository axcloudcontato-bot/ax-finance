import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import {
  CategoryNotFoundError,
  CostCenterNotFoundError,
  CreditCardCategoryInvalidError,
  CreditCardInstallmentCountInvalidError,
  CreditCardInvoicePaidError,
  CreditCardNotFoundError,
  CreditCardPurchaseAlreadyCanceledError,
  CreditCardPurchaseNotFoundError,
  IdempotencyResultUnavailableError,
  PartyNotFoundError,
} from "../errors";
import { beginIdempotentOperation, completeIdempotentOperation, idempotencyKeySchema } from "../idempotency/operations";
import { assertCardAccess, CARD_INVOICE_CATEGORY_NAME, ensureInvoice, syncInvoiceTitle } from "./invoices";
import { cyclesForInstallments, installmentCompetenceDate, splitInstallments } from "./invoice-cycle";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createCreditCardPurchaseInput = z.object({
  cardId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  // Valor TOTAL da compra, em centavos inteiros; em compra parcelada é dividido pelas parcelas.
  totalAmountCents: z.number().int().positive(),
  purchaseDate: dateOnly,
  installmentCount: z.number().int().min(1).max(48).default(1),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateCreditCardPurchaseInput = z.infer<typeof createCreditCardPurchaseInput>;

async function assertClassification(
  tx: TenantScopedClient,
  companyId: string,
  data: { categoryId: string; partyId?: string; costCenterId?: string },
) {
  const category = await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE" } });
  if (!category) throw new CategoryNotFoundError();
  // A categoria da própria fatura contaria o gasto duas vezes (compra + pagamento); receita não é compra.
  if (category.nature === "OPERATING_REVENUE" || category.name === CARD_INVOICE_CATEGORY_NAME) throw new CreditCardCategoryInvalidError();
  if (data.partyId && !(await tx.party.findFirst({ where: { id: data.partyId, companyId, status: "ACTIVE" } }))) throw new PartyNotFoundError();
  if (data.costCenterId && !(await tx.costCenter.findFirst({ where: { id: data.costCenterId, companyId, status: "ACTIVE" } }))) throw new CostCenterNotFoundError();
}

/**
 * Lança uma compra no cartão. Cada parcela vira uma linha na fatura do seu ciclo (a 1ª na fatura
 * que a data da compra define, as demais nas seguintes), e o título de cada fatura afetada é
 * recalculado na mesma transação. O limite do cartão é informativo: a compra já aconteceu no
 * mundo real, então não é recusada por passar do limite — a tela avisa.
 */
export async function createCreditCardPurchase(userId: string, companyId: string, input: unknown) {
  const data = createCreditCardPurchaseInput.parse(input);
  if (data.totalAmountCents < data.installmentCount) throw new CreditCardInstallmentCountInvalidError();
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);

    const { idempotencyKey, ...request } = data;
    const idempotency = await beginIdempotentOperation(tx, {
      companyId,
      operation: `CREATE_CARD_PURCHASE:${data.cardId}`,
      key: idempotencyKey,
      request,
      resourceType: "CreditCardPurchase",
    });
    if (idempotency.kind === "replay") {
      const first = await tx.creditCardPurchase.findFirst({ where: { id: idempotency.resourceId, companyId } });
      if (!first) throw new IdempotencyResultUnavailableError();
      return first.installmentGroupId
        ? tx.creditCardPurchase.findMany({ where: { companyId, installmentGroupId: first.installmentGroupId }, orderBy: { installmentNumber: "asc" } })
        : [first];
    }

    // Serializa lançamentos no mesmo cartão: a criação da fatura de um ciclo é "achar ou criar".
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "credit_cards" WHERE id = ${data.cardId} AND company_id = ${companyId} AND status = 'ACTIVE' FOR UPDATE`;
    if (locked.length === 0) throw new CreditCardNotFoundError();
    const card = await tx.creditCard.findFirstOrThrow({ where: { id: data.cardId, companyId } });

    await assertClassification(tx, companyId, data);

    const cycles = cyclesForInstallments(card, data.purchaseDate, data.installmentCount);
    const amounts = splitInstallments(data.totalAmountCents, data.installmentCount);
    const groupId = data.installmentCount > 1 ? randomUUID() : null;

    const invoiceByMonth = new Map<string, Awaited<ReturnType<typeof ensureInvoice>>>();
    for (const cycle of cycles) {
      if (invoiceByMonth.has(cycle.referenceMonth)) continue;
      const invoice = await ensureInvoice(tx, companyId, card, cycle);
      if (invoice.title.status === "SETTLED") throw new CreditCardInvoicePaidError(invoice.referenceMonth);
      invoiceByMonth.set(cycle.referenceMonth, invoice);
    }

    const purchases = [];
    for (const [index, cycle] of cycles.entries()) {
      const invoice = invoiceByMonth.get(cycle.referenceMonth)!;
      purchases.push(
        await tx.creditCardPurchase.create({
          data: {
            companyId,
            cardId: card.id,
            invoiceId: invoice.id,
            description: data.description,
            categoryId: data.categoryId,
            costCenterId: data.costCenterId,
            partyId: data.partyId,
            amountCents: BigInt(amounts[index]!),
            purchaseDate: new Date(data.purchaseDate),
            competenceDate: new Date(installmentCompetenceDate(data.purchaseDate, index)),
            installmentGroupId: groupId,
            installmentNumber: groupId ? index + 1 : null,
            installmentCount: groupId ? data.installmentCount : null,
            notes: data.notes,
            createdByUserId: userId,
          },
        }),
      );
    }

    for (const invoice of invoiceByMonth.values()) await syncInvoiceTitle(tx, companyId, invoice.id, userId);

    const first = purchases[0]!;
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "CREDIT_CARD_PURCHASE_CREATED", resourceType: "CreditCardPurchase", resourceId: first.id,
      summary: data.description,
      metadata: { cardId: card.id, totalAmountCents: data.totalAmountCents, installmentCount: data.installmentCount, purchaseDate: data.purchaseDate },
    });
    await completeIdempotentOperation(tx, idempotency, first.id);
    return purchases;
  });
}

export const updateCreditCardPurchaseInput = z.object({
  description: z.string().trim().min(1).max(500),
  categoryId: z.string().uuid(),
  partyId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Só a classificação e o texto mudam. Valor e data definem em qual fatura e por quanto a compra
 * pesa; para corrigi-los, cancele a compra e lance de novo (fica o rastro na auditoria).
 */
export async function updateCreditCardPurchase(userId: string, companyId: string, purchaseId: string, input: unknown) {
  const data = updateCreditCardPurchaseInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const purchase = await tx.creditCardPurchase.findFirst({ where: { id: purchaseId, companyId } });
    if (!purchase) throw new CreditCardPurchaseNotFoundError();
    if (purchase.canceledAt) throw new CreditCardPurchaseAlreadyCanceledError();
    await assertClassification(tx, companyId, data);

    const updated = await tx.creditCardPurchase.update({
      where: { id: purchase.id },
      data: {
        description: data.description,
        categoryId: data.categoryId,
        partyId: data.partyId ?? null,
        costCenterId: data.costCenterId ?? null,
        notes: data.notes ?? null,
      },
    });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "CREDIT_CARD_PURCHASE_UPDATED", resourceType: "CreditCardPurchase", resourceId: purchase.id,
      summary: data.description, metadata: { cardId: purchase.cardId },
    });
    return updated;
  });
}

export const cancelCreditCardPurchaseInput = z.object({
  reason: z.string().trim().min(1).max(500),
  /** Em compra parcelada: cancela esta parcela e todas as seguintes (as anteriores já foram cobradas). */
  includeFollowingInstallments: z.boolean().default(false),
});

/**
 * Cancela (não apaga) a compra: a linha fica com motivo e data, o total da fatura é recalculado.
 * Recusa quando a fatura afetada já foi paga — nesse caso é preciso estornar o pagamento antes.
 */
export async function cancelCreditCardPurchase(userId: string, companyId: string, purchaseId: string, input: unknown) {
  const data = cancelCreditCardPurchaseInput.parse(input);
  await assertCompanyPermission(userId, companyId, "REVERSAL");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const purchase = await tx.creditCardPurchase.findFirst({ where: { id: purchaseId, companyId } });
    if (!purchase) throw new CreditCardPurchaseNotFoundError();
    if (purchase.canceledAt) throw new CreditCardPurchaseAlreadyCanceledError();

    await tx.$queryRaw`SELECT id FROM "credit_cards" WHERE id = ${purchase.cardId} AND company_id = ${companyId} FOR UPDATE`;

    const targets =
      data.includeFollowingInstallments && purchase.installmentGroupId && purchase.installmentNumber
        ? await tx.creditCardPurchase.findMany({
            where: { companyId, installmentGroupId: purchase.installmentGroupId, installmentNumber: { gte: purchase.installmentNumber }, canceledAt: null },
            include: { invoice: { include: { title: { select: { status: true } } } } },
            orderBy: { installmentNumber: "asc" },
          })
        : await tx.creditCardPurchase.findMany({
            where: { id: purchase.id, companyId },
            include: { invoice: { include: { title: { select: { status: true } } } } },
          });

    for (const target of targets) {
      if (target.invoice.title.status === "SETTLED") throw new CreditCardInvoicePaidError(target.invoice.referenceMonth);
    }

    const now = new Date();
    await tx.creditCardPurchase.updateMany({
      where: { companyId, id: { in: targets.map((target) => target.id) } },
      data: { canceledAt: now, cancelReason: data.reason },
    });
    for (const invoiceId of new Set(targets.map((target) => target.invoiceId))) await syncInvoiceTitle(tx, companyId, invoiceId, userId);

    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "CREDIT_CARD_PURCHASE_CANCELED", resourceType: "CreditCardPurchase", resourceId: purchase.id,
      summary: data.reason,
      metadata: {
        cardId: purchase.cardId,
        description: purchase.description,
        canceledCount: targets.length,
        canceledAmountCents: targets.reduce((sum, target) => sum + target.amountCents, BigInt(0)).toString(),
      },
    });
    return { canceledCount: targets.length };
  });
}
