"use server";

import { redirect } from "next/navigation";
import { registerSettlement, registerTitleCollection, setTitleScheduledPayment, updateLateFeeSettings } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";
import { listReturnPath } from "@/lib/title-list-params";

/**
 * Ações feitas direto da lista (e da página do lançamento) de entradas e saídas. Todas voltam para a
 * tela de onde saíram (`returnTo`, validado), em vez de levar a pessoa para outra página.
 */

async function context() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Baixa total ou parcial pelo botão "Pagar"/"Receber" da linha. */
export async function quickSettleTitleAction(returnTo: string, titleId: string, formData: FormData) {
  const { user, company } = await context();
  try {
    await registerSettlement(user.id, company.id, titleId, {
      financialAccountId: text(formData, "financialAccountId"),
      principalAmountCents: parseAmountToCents(text(formData, "principalAmount")),
      discountCents: parseAmountToCents(text(formData, "discountAmount")),
      interestPenaltyCents: parseAmountToCents(text(formData, "interestPenaltyAmount")),
      feesCents: parseAmountToCents(text(formData, "feesAmount")),
      effectiveDate: text(formData, "effectiveDate"),
      paymentMethod: text(formData, "paymentMethod") || undefined,
      idempotencyKey: text(formData, "idempotencyKey") || undefined,
    });
  } catch (error) {
    redirect(listReturnPath(returnTo, { erroBaixa: actionErrorMessage(error, "Não foi possível registrar a baixa."), titulo: titleId }, ["erro", "erroBaixa", "baixado", "cobrado", "agendado", "multaSalva", "titulo"]));
  }
  redirect(listReturnPath(returnTo, { baixado: "1" }, ["erro", "erroBaixa", "baixado", "cobrado", "agendado", "multaSalva", "titulo"]));
}

/** Registra que a cobrança foi feita (a mensagem em si é copiada ou enviada pela própria pessoa). */
export async function registerCollectionAction(returnTo: string, titleId: string) {
  const { user, company } = await context();
  try {
    await registerTitleCollection(user.id, company.id, titleId);
  } catch (error) {
    redirect(listReturnPath(returnTo, { erro: actionErrorMessage(error, "Não foi possível registrar a cobrança.") }));
  }
  redirect(listReturnPath(returnTo, { cobrado: "1" }));
}

/** Agenda (com data) ou remove (sem data) o pagamento marcado no banco. */
export async function scheduleTitlePaymentAction(returnTo: string, titleId: string, formData: FormData) {
  const { user, company } = await context();
  const date = text(formData, "scheduledPaymentDate").trim();
  try {
    await setTitleScheduledPayment(user.id, company.id, titleId, date || null);
  } catch (error) {
    redirect(listReturnPath(returnTo, { erro: actionErrorMessage(error, "Não foi possível agendar o pagamento.") }));
  }
  redirect(listReturnPath(returnTo, { agendado: date ? "1" : "0" }));
}

/** Multa e juros ao mês (em %) usados para sugerir o valor ao receber um título atrasado. */
export async function updateLateFeeAction(returnTo: string, formData: FormData) {
  const { user, company } = await context();
  const percent = (key: string) => {
    const value = Number(text(formData, key).replace(",", "."));
    return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
  };
  try {
    await updateLateFeeSettings(user.id, company.id, { lateFeeBps: percent("lateFee"), lateInterestMonthlyBps: percent("lateInterest") });
  } catch (error) {
    redirect(listReturnPath(returnTo, { erro: actionErrorMessage(error, "Não foi possível salvar a multa e os juros.") }));
  }
  redirect(listReturnPath(returnTo, { multaSalva: "1" }));
}
