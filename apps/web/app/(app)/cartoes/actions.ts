"use server";

import { redirect } from "next/navigation";
import {
  archiveCreditCard,
  cancelCreditCardPurchase,
  createCreditCard,
  createCreditCardPurchase,
  payCreditCardInvoice,
  reactivateCreditCard,
  updateCreditCard,
  updateCreditCardPurchase,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

// Mesmo cuidado das demais actions: só a chamada ao domínio (que lança DomainError) fica dentro do
// try/catch, porque `redirect()` lança um erro especial que o catch engoliria.

async function currentContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function optional(formData: FormData, key: string): string | undefined {
  return text(formData, key).trim() || undefined;
}

function toRedirect(path: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(query ? `${path}?${query}` : path);
}

function cardInput(formData: FormData) {
  return {
    name: text(formData, "name"),
    brand: text(formData, "brand") || "OTHER",
    issuer: optional(formData, "issuer"),
    lastDigits: optional(formData, "lastDigits"),
    limitCents: parseAmountToCents(text(formData, "limit")),
    closingDay: Number(text(formData, "closingDay")),
    dueDay: Number(text(formData, "dueDay")),
    defaultPaymentAccountId: optional(formData, "defaultPaymentAccountId"),
  };
}

export async function createCardAction(formData: FormData) {
  const { user, company } = await currentContext();
  let cardId: string;
  try {
    cardId = (await createCreditCard(user.id, company.id, cardInput(formData))).id;
  } catch (error) {
    toRedirect("/cartoes", { erro: error instanceof Error ? error.message : "Não foi possível criar o cartão." });
  }
  redirect(`/cartoes/${cardId}?novo=1`);
}

export async function updateCardAction(cardId: string, formData: FormData) {
  const { user, company } = await currentContext();
  try {
    await updateCreditCard(user.id, company.id, cardId, cardInput(formData));
  } catch (error) {
    toRedirect(`/cartoes/${cardId}`, { erroCartao: error instanceof Error ? error.message : "Não foi possível salvar o cartão." });
  }
  toRedirect(`/cartoes/${cardId}`, { atualizado: "1" });
}

export async function setCardArchivedAction(cardId: string, archive: boolean) {
  const { user, company } = await currentContext();
  try {
    if (archive) await archiveCreditCard(user.id, company.id, cardId);
    else await reactivateCreditCard(user.id, company.id, cardId);
  } catch (error) {
    toRedirect(`/cartoes/${cardId}`, { erroCartao: error instanceof Error ? error.message : "Não foi possível alterar o cartão." });
  }
  toRedirect("/cartoes", archive ? { arquivado: "1" } : { reativado: "1" });
}

/**
 * Compra no cartão. `voltar` diz para onde ir depois (a lista de cartões ou a página do cartão);
 * em caso de erro volta para lá com `erro=`, que reabre o modal.
 */
export async function createPurchaseAction(cardId: string, voltar: string, formData: FormData) {
  const { user, company } = await currentContext();
  const base = voltar === "lista" ? "/cartoes" : `/cartoes/${cardId}`;
  let firstId: string;
  try {
    const purchases = await createCreditCardPurchase(user.id, company.id, {
      cardId,
      description: text(formData, "description"),
      categoryId: text(formData, "categoryId"),
      partyId: optional(formData, "partyId"),
      costCenterId: optional(formData, "costCenterId"),
      totalAmountCents: parseAmountToCents(text(formData, "amount")),
      purchaseDate: text(formData, "purchaseDate"),
      installmentCount: Number(text(formData, "installmentCount") || "1"),
      notes: optional(formData, "notes"),
      idempotencyKey: optional(formData, "idempotencyKey"),
    });
    firstId = purchases[0]!.id;
  } catch (error) {
    toRedirect(base, { erro: error instanceof Error ? error.message : "Não foi possível lançar a compra.", cartao: cardId });
  }
  toRedirect(base, { comprado: firstId });
}

export async function updatePurchaseAction(cardId: string, invoiceId: string, purchaseId: string, formData: FormData) {
  const { user, company } = await currentContext();
  const base = `/cartoes/${cardId}/faturas/${invoiceId}`;
  try {
    await updateCreditCardPurchase(user.id, company.id, purchaseId, {
      description: text(formData, "description"),
      categoryId: text(formData, "categoryId"),
      partyId: optional(formData, "partyId"),
      costCenterId: optional(formData, "costCenterId"),
      notes: optional(formData, "notes"),
    });
  } catch (error) {
    toRedirect(base, { erroEdicao: error instanceof Error ? error.message : "Não foi possível salvar a compra.", compra: purchaseId });
  }
  toRedirect(base, { editado: purchaseId });
}

export async function cancelPurchaseAction(cardId: string, invoiceId: string, purchaseId: string, formData: FormData) {
  const { user, company } = await currentContext();
  const base = `/cartoes/${cardId}/faturas/${invoiceId}`;
  try {
    await cancelCreditCardPurchase(user.id, company.id, purchaseId, {
      reason: text(formData, "reason"),
      includeFollowingInstallments: text(formData, "includeFollowingInstallments") === "true",
    });
  } catch (error) {
    toRedirect(base, { erroCancelamento: error instanceof Error ? error.message : "Não foi possível cancelar a compra.", compra: purchaseId });
  }
  toRedirect(base, { cancelado: purchaseId });
}

export async function payInvoiceAction(cardId: string, invoiceId: string, formData: FormData) {
  const { user, company } = await currentContext();
  const base = `/cartoes/${cardId}/faturas/${invoiceId}`;
  const amount = text(formData, "amount").trim();
  try {
    await payCreditCardInvoice(user.id, company.id, invoiceId, {
      financialAccountId: text(formData, "financialAccountId"),
      amountCents: amount ? parseAmountToCents(amount) : undefined,
      interestPenaltyCents: parseAmountToCents(text(formData, "interestPenalty") || "0"),
      feesCents: parseAmountToCents(text(formData, "fees") || "0"),
      effectiveDate: text(formData, "effectiveDate"),
      notes: optional(formData, "notes"),
      idempotencyKey: optional(formData, "idempotencyKey"),
    });
  } catch (error) {
    toRedirect(base, { erroPagamento: error instanceof Error ? error.message : "Não foi possível registrar o pagamento." });
  }
  toRedirect(base, { pago: "1" });
}
