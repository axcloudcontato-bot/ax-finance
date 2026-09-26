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
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

/**
 * Só a chamada ao domínio (que pode lançar DomainError) fica dentro do
 * try/catch de cada action — resolver usuário/empresa aqui dentro seria um
 * `redirect("/login")` escondido dentro de um try, que o catch da action
 * engoliria e reportaria como "NEXT_REDIRECT" (mesmo bug já visto no fluxo
 * de conciliação).
 */
async function createEntradaCore(userId: string, companyId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const amount = String(formData.get("amount") ?? "0");
  const competenceDate = String(formData.get("competenceDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const notes = String(formData.get("notes") ?? "");

  const title = await createTitle(userId, companyId, {
    type: "RECEIVABLE",
    description,
    categoryId,
    partyId,
    originalAmountCents: parseAmountToCents(amount),
    competenceDate,
    dueDate,
    notes: notes || undefined,
  });

  return title.id;
}

/** Modal "Nova entrada" na lista — botão "Salvar": cria e fecha o modal. */
export async function createEntradaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let titleId: string;
  try {
    titleId = await createEntradaCore(user.id, company.id, formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o lançamento.";
    redirect(`/entradas?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas?criado=${titleId}`);
}

/** Botão "Salvar e nova entrada": cria e mantém o modal aberto, formulário limpo. */
export async function createEntradaAndContinueAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  let titleId: string;
  try {
    titleId = await createEntradaCore(user.id, company.id, formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o lançamento.";
    redirect(`/entradas?erro=${encodeURIComponent(message)}`);
  }

  // O valor de "continuar" precisa mudar a cada envio (não um "1" fixo) —
  // o form usa <input defaultValue>, que só é aplicado na montagem; um
  // React key idêntico entre uma chamada e outra não força o remount que
  // limpa os campos (ver TitleForm key={searchParams.continuar} na página).
  redirect(`/entradas?continuar=${titleId}`);
}

export async function createEntradaInstallmentPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const totalAmount = String(formData.get("totalAmount") ?? "0");
  const installmentCount = Number(formData.get("installmentCount") ?? "0");
  const firstDueDate = String(formData.get("firstDueDate") ?? "");
  const intervalMonths = Number(formData.get("intervalMonths") ?? "1");
  const notes = String(formData.get("notes") ?? "");

  try {
    await createInstallmentPlan(user.id, company.id, {
      type: "RECEIVABLE",
      description,
      categoryId,
      partyId,
      totalAmountCents: parseAmountToCents(totalAmount),
      installmentCount,
      firstDueDate,
      intervalMonths,
      notes: notes || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o parcelamento.";
    redirect(`/entradas/parcelado?erro=${encodeURIComponent(message)}`);
  }

  redirect("/entradas");
}

export async function registerEntradaSettlementAction(titleId: string, formData: FormData) {
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

  try {
    await registerSettlement(user.id, company.id, titleId, {
      financialAccountId,
      principalAmountCents: parseAmountToCents(principalAmount),
      discountCents: parseAmountToCents(discountAmount),
      interestPenaltyCents: parseAmountToCents(interestPenaltyAmount),
      feesCents: parseAmountToCents(feesAmount),
      effectiveDate,
      paymentMethod: paymentMethod || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a baixa.";
    redirect(`/entradas/${titleId}?erroBaixa=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

export async function reverseEntradaSettlementAction(
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
    const message = error instanceof Error ? error.message : "Não foi possível estornar.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

export async function cancelEntradaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelado pelo usuário";

  try {
    await cancelTitle(user.id, company.id, titleId, { reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cancelar.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

/** Exclusão de verdade (remove a linha, diferente de cancelar) — some da lista, por isso volta pra /entradas. */
export async function deleteEntradaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    await deleteTitle(user.id, company.id, titleId, { reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect("/entradas");
}

/**
 * Exclui todas as parcelas do parcelamento de uma vez. `titleId` é só a
 * parcela que estava sendo vista quando o botão foi clicado — usada apenas
 * para saber pra onde voltar se der erro (o "erro=" da lista de entradas já
 * é usado pelo modal de criação; reaproveitar aqui abriria aquele modal por
 * engano).
 */
export async function deleteEntradaInstallmentPlanAction(
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
    const message = error instanceof Error ? error.message : "Não foi possível excluir o parcelamento.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect("/entradas");
}
