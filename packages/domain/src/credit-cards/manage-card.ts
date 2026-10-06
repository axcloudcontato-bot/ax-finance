import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CreditCardHasOpenInvoicesError, CreditCardNotFoundError, FinancialAccountNotFoundError } from "../errors";
import { assertCardAccess, invoiceDescription } from "./invoices";

export const creditCardInput = z.object({
  name: z.string().trim().min(1).max(100),
  brand: z.enum(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"]).default("OTHER"),
  // Só os 4 últimos dígitos, nunca o número completo: serve para distinguir cartões parecidos.
  lastDigits: z.string().regex(/^\d{4}$/, "Informe só os 4 últimos dígitos.").optional(),
  // Centavos inteiros — nunca float (Seção 18, regra 1).
  limitCents: z.number().int().positive(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  defaultPaymentAccountId: z.string().uuid().optional(),
});

export type CreditCardInput = z.infer<typeof creditCardInput>;

async function assertPaymentAccount(tx: TenantScopedClient, companyId: string, accountId?: string) {
  if (!accountId) return;
  const account = await tx.financialAccount.findFirst({ where: { id: accountId, companyId, status: "ACTIVE" } });
  if (!account) throw new FinancialAccountNotFoundError();
}

export async function createCreditCard(userId: string, companyId: string, input: unknown) {
  const data = creditCardInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    await assertPaymentAccount(tx, companyId, data.defaultPaymentAccountId);

    const card = await tx.creditCard.create({
      data: {
        companyId,
        name: data.name,
        brand: data.brand,
        lastDigits: data.lastDigits,
        limitCents: BigInt(data.limitCents),
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        defaultPaymentAccountId: data.defaultPaymentAccountId,
      },
    });
    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "CREDIT_CARD_CREATED", resourceType: "CreditCard", resourceId: card.id,
      summary: card.name, metadata: { limitCents: data.limitCents, closingDay: data.closingDay, dueDay: data.dueDay },
    });
    return card;
  });
}

/**
 * Editar nome/limite/conta padrão vale na hora. Mudar fechamento ou vencimento só vale para as
 * faturas que ainda vão ser criadas: as já existentes guardam as próprias datas, porque compras
 * já lançadas não podem trocar de fatura por mudança de configuração.
 */
export async function updateCreditCard(userId: string, companyId: string, cardId: string, input: unknown) {
  const data = creditCardInput.parse(input);
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const card = await tx.creditCard.findFirst({ where: { id: cardId, companyId } });
    if (!card) throw new CreditCardNotFoundError();
    await assertPaymentAccount(tx, companyId, data.defaultPaymentAccountId);

    const updated = await tx.creditCard.update({
      where: { id: card.id },
      data: {
        name: data.name,
        brand: data.brand,
        lastDigits: data.lastDigits ?? null,
        limitCents: BigInt(data.limitCents),
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        defaultPaymentAccountId: data.defaultPaymentAccountId ?? null,
      },
    });

    if (card.name !== data.name) {
      const invoices = await tx.creditCardInvoice.findMany({ where: { companyId, cardId: card.id }, select: { titleId: true, referenceMonth: true } });
      for (const invoice of invoices) {
        await tx.title.update({ where: { id: invoice.titleId }, data: { description: invoiceDescription(data.name, invoice.referenceMonth) } });
      }
    }

    await recordAuditEvent(tx, {
      companyId, actorUserId: userId, eventType: "CREDIT_CARD_UPDATED", resourceType: "CreditCard", resourceId: card.id,
      summary: data.name,
      metadata: {
        previousLimitCents: card.limitCents.toString(), limitCents: data.limitCents,
        previousClosingDay: card.closingDay, closingDay: data.closingDay,
        previousDueDay: card.dueDay, dueDay: data.dueDay,
      },
    });
    return updated;
  });
}

/** Arquivar exige que não haja dívida pendente: o histórico (compras e faturas pagas) permanece. */
export async function archiveCreditCard(userId: string, companyId: string, cardId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const card = await tx.creditCard.findFirst({ where: { id: cardId, companyId } });
    if (!card) throw new CreditCardNotFoundError();

    const pending = await tx.creditCardInvoice.findFirst({
      where: { companyId, cardId: card.id, title: { status: { in: ["OPEN", "PARTIALLY_SETTLED"] } } },
      select: { id: true },
    });
    if (pending) throw new CreditCardHasOpenInvoicesError();

    const updated = await tx.creditCard.update({ where: { id: card.id }, data: { status: "ARCHIVED" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CREDIT_CARD_ARCHIVED", resourceType: "CreditCard", resourceId: card.id, summary: card.name });
    return updated;
  });
}

export async function reactivateCreditCard(userId: string, companyId: string, cardId: string) {
  await assertCompanyPermission(userId, companyId, "FINANCE_WRITE");

  return withCompanyContext(userId, companyId, async (tx) => {
    await assertCardAccess(tx, userId, companyId);
    const card = await tx.creditCard.findFirst({ where: { id: cardId, companyId } });
    if (!card) throw new CreditCardNotFoundError();
    const updated = await tx.creditCard.update({ where: { id: card.id }, data: { status: "ACTIVE" } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CREDIT_CARD_REACTIVATED", resourceType: "CreditCard", resourceId: card.id, summary: card.name });
    return updated;
  });
}
