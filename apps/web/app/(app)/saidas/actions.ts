"use server";

import { redirect } from "next/navigation";
import {
  cancelTitle,
  createInstallmentPlan,
  createTitle,
  deleteInstallmentPlan,
  deleteTitle,
  registerSettlement,
  reverseSettlement,
  clearTitleAllocations,
  duplicateTitle,
  registerSettlementRefund,
  replaceTitleAllocations,
  reverseSettlementRefund,
  updateTitle,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

/**
 * Só a chamada ao domínio (que pode lançar DomainError) fica dentro do
 * try/catch de cada action — resolver usuário/empresa aqui dentro seria um
 * `redirect("/login")` escondido dentro de um try, que o catch da action
 * engoliria e reportaria como "NEXT_REDIRECT" (mesmo bug já visto no fluxo
 * de conciliação).
 */
async function createSaidaCore(userId: string, companyId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const costCenterId = String(formData.get("costCenterId") ?? "") || undefined;
  const amount = String(formData.get("amount") ?? "0");
  const competenceDate = String(formData.get("competenceDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  const title = await createTitle(userId, companyId, {
    type: "PAYABLE",
    description,
    categoryId,
    partyId,
    costCenterId,
    originalAmountCents: parseAmountToCents(amount),
    competenceDate,
    dueDate,
    notes: notes || undefined,
    idempotencyKey,
  });

  return title.id;
}

/** Modal "Nova saída" na lista — botão "Salvar": cria e fecha o modal. */
export async function createSaidaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let titleId: string;
  try {
    titleId = await createSaidaCore(user.id, company.id, formData);
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível criar o lançamento.");
    redirect(`/saidas?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/saidas?criado=${titleId}`);
}

/** Botão "Salvar e nova saída": cria e mantém o modal aberto, formulário limpo. */
export async function createSaidaAndContinueAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let titleId: string;
  try {
    titleId = await createSaidaCore(user.id, company.id, formData);
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível criar o lançamento.");
    redirect(`/saidas?erro=${encodeURIComponent(message)}`);
  }

  // O valor de "continuar" precisa mudar a cada envio (não um "1" fixo) —
  // o form usa <input defaultValue>, que só é aplicado na montagem; um
  // React key idêntico entre uma chamada e outra não força o remount que
  // limpa os campos (ver TitleForm key={searchParams.continuar} na página).
  redirect(`/saidas?continuar=${titleId}`);
}

export async function createSaidaInstallmentPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const costCenterId = String(formData.get("costCenterId") ?? "") || undefined;
  const totalAmount = String(formData.get("totalAmount") ?? "0");
  const installmentCount = Number(formData.get("installmentCount") ?? "0");
  const firstDueDate = String(formData.get("firstDueDate") ?? "");
  const intervalMonths = Number(formData.get("intervalMonths") ?? "1");
  const notes = String(formData.get("notes") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  try {
    await createInstallmentPlan(user.id, company.id, {
      type: "PAYABLE",
      description,
      categoryId,
      partyId,
      costCenterId,
      totalAmountCents: parseAmountToCents(totalAmount),
      installmentCount,
      firstDueDate,
      intervalMonths,
      notes: notes || undefined,
      idempotencyKey,
    });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível criar o parcelamento.");
    redirect(`/saidas/parcelado?erro=${encodeURIComponent(message)}`);
  }

  redirect("/saidas");
}

export async function updateSaidaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser(); if (!user) redirect("/login"); const company = await requirePrimaryCompany(user.id);
  try { await updateTitle(user.id, company.id, titleId, { description:String(formData.get("description") ?? ""), categoryId:String(formData.get("categoryId") ?? ""), partyId:String(formData.get("partyId") ?? "") || undefined, costCenterId:String(formData.get("costCenterId") ?? "") || undefined, originalAmountCents:parseAmountToCents(String(formData.get("amount") ?? "0")), competenceDate:String(formData.get("competenceDate") ?? ""), dueDate:String(formData.get("dueDate") ?? ""), notes:String(formData.get("notes") ?? "") || undefined }); }
  catch (error) { redirect(`/saidas/${titleId}?erroEdicao=${encodeURIComponent(actionErrorMessage(error, "Não foi possível editar o título."))}`); }
  redirect(`/saidas/${titleId}?atualizado=1`);
}

export async function duplicateSaidaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser(); if (!user) redirect("/login"); const company = await requirePrimaryCompany(user.id); let duplicateId:string;
  try { duplicateId=(await duplicateTitle(user.id, company.id, titleId, { competenceDate:String(formData.get("competenceDate") ?? "") || undefined, dueDate:String(formData.get("dueDate") ?? "") || undefined })).id; }
  catch(error){redirect(`/saidas/${titleId}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível duplicar."))}`);} redirect(`/saidas/${duplicateId}?duplicado=1`);
}

export async function registerSaidaRefundAction(titleId:string, settlementId:string, formData:FormData){const user=await getCurrentUser();if(!user)redirect("/login");const company=await requirePrimaryCompany(user.id);try{await registerSettlementRefund(user.id,company.id,settlementId,{financialAccountId:String(formData.get("financialAccountId")??""),amountCents:parseAmountToCents(String(formData.get("amount")??"0")),effectiveDate:String(formData.get("effectiveDate")??""),reason:String(formData.get("reason")??"")});}catch(error){redirect(`/saidas/${titleId}?erroDevolucao=${encodeURIComponent(actionErrorMessage(error, "Não foi possível registrar o reembolso."))}`);}redirect(`/saidas/${titleId}`);}

export async function reverseSaidaRefundAction(titleId:string,refundId:string,formData:FormData){const user=await getCurrentUser();if(!user)redirect("/login");const company=await requirePrimaryCompany(user.id);const reason=String(formData.get("reason")??"").trim();try{await reverseSettlementRefund(user.id,company.id,refundId,{reason});}catch(error){redirect(`/saidas/${titleId}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível estornar o reembolso."))}`);}redirect(`/saidas/${titleId}`);}

export async function replaceSaidaAllocationsAction(titleId:string,formData:FormData){const user=await getCurrentUser();if(!user)redirect("/login");const company=await requirePrimaryCompany(user.id);const count=Number(formData.get("rowCount")??0);const allocations=Array.from({length:count},(_,index)=>({categoryId:String(formData.get(`categoryId-${index}`)??""),costCenterId:String(formData.get(`costCenterId-${index}`)??"")||undefined,amountCents:parseAmountToCents(String(formData.get(`amount-${index}`)??"0"))}));try{await replaceTitleAllocations(user.id,company.id,titleId,{allocations});}catch(error){redirect(`/saidas/${titleId}?erroRateio=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar o rateio."))}`);}redirect(`/saidas/${titleId}?rateado=1`);}

export async function clearSaidaAllocationsAction(titleId:string){const user=await getCurrentUser();if(!user)redirect("/login");const company=await requirePrimaryCompany(user.id);await clearTitleAllocations(user.id,company.id,titleId);redirect(`/saidas/${titleId}`);}

export async function registerSaidaSettlementAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const financialAccountId = String(formData.get("financialAccountId") ?? "");
  const principalAmount = String(formData.get("principalAmount") ?? "0");
  const discountAmount = String(formData.get("discountAmount") ?? "0");
  const interestPenaltyAmount = String(formData.get("interestPenaltyAmount") ?? "0");
  const feesAmount = String(formData.get("feesAmount") ?? "0");
  const effectiveDate = String(formData.get("effectiveDate") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  try {
    await registerSettlement(user.id, company.id, titleId, {
      financialAccountId,
      principalAmountCents: parseAmountToCents(principalAmount),
      discountCents: parseAmountToCents(discountAmount),
      interestPenaltyCents: parseAmountToCents(interestPenaltyAmount),
      feesCents: parseAmountToCents(feesAmount),
      effectiveDate,
      paymentMethod: paymentMethod || undefined,
      idempotencyKey,
    });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível registrar o pagamento.");
    redirect(`/saidas/${titleId}?erroBaixa=${encodeURIComponent(message)}`);
  }

  redirect(`/saidas/${titleId}`);
}

export async function reverseSaidaSettlementAction(
  titleId: string,
  settlementId: string,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Estornado pelo usuário";

  try {
    await reverseSettlement(user.id, company.id, settlementId, { reason });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível estornar.");
    redirect(`/saidas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/saidas/${titleId}`);
}

export async function cancelSaidaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelado pelo usuário";

  try {
    await cancelTitle(user.id, company.id, titleId, { reason });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível cancelar.");
    redirect(`/saidas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/saidas/${titleId}`);
}

/** Soft delete: remove das telas operacionais e preserva histórico, baixas e anexos. */
export async function deleteSaidaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    await deleteTitle(user.id, company.id, titleId, { reason });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível excluir.");
    redirect(`/saidas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect("/saidas");
}

/**
 * Exclui todas as parcelas do parcelamento de uma vez. `titleId` é só a
 * parcela que estava sendo vista quando o botão foi clicado — usada apenas
 * para saber pra onde voltar se der erro (o "erro=" da lista de saídas já
 * é usado pelo modal de criação; reaproveitar aqui abriria aquele modal por
 * engano).
 */
export async function deleteSaidaInstallmentPlanAction(
  installmentGroupId: string,
  titleId: string,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    await deleteInstallmentPlan(user.id, company.id, installmentGroupId, { reason });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível excluir o parcelamento.");
    redirect(`/saidas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect("/saidas");
}
