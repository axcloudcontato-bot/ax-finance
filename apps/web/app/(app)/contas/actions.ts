"use server";

import { redirect } from "next/navigation";
import { createBalanceAdjustment, createFinancialAccount, reverseBalanceAdjustment } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

export async function createAccountAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "BANK") as "BANK" | "CASH" | "WALLET";
  const openingBalance = String(formData.get("openingBalance") ?? "0");
  const openingDate = String(formData.get("openingDate") ?? "");

  let accountId: string;
  try {
    const account = await createFinancialAccount(user.id, company.id, {
      name,
      type,
      openingBalanceCents: parseAmountToCents(openingBalance),
      openingDate,
    });
    accountId = account.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a conta.";
    redirect(`/contas?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/contas?criado=${accountId}`);
}

/**
 * "contaAjuste=" (além de "erroAjuste=") é pra reabrir o modal da conta
 * certa em caso de erro — cada linha da tabela tem seu próprio ActionModal,
 * e "erro=" sozinho não diria qual deles.
 */
export async function createBalanceAdjustmentAction(financialAccountId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const targetBalance = String(formData.get("targetBalance") ?? "0");
  const reason = String(formData.get("reason") ?? "");
  const effectiveDate = String(formData.get("effectiveDate") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  let adjustmentId: string;
  try {
    const adjustment = await createBalanceAdjustment(user.id, company.id, {
      financialAccountId,
      targetBalanceCents: parseAmountToCents(targetBalance),
      reason,
      effectiveDate,
      idempotencyKey,
    });
    adjustmentId = adjustment.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ajustar o saldo.";
    redirect(`/contas?contaAjuste=${financialAccountId}&erroAjuste=${encodeURIComponent(message)}`);
  }

  // "ajustado=" muda a cada sucesso — usado como key pra forçar o modal (que
  // não observa query string, ao contrário do Modal genérico) a remontar
  // fechado, em vez de ficar aberto com o próprio estado local preservado.
  redirect(`/contas?ajustado=${adjustmentId}`);
}

export async function reverseBalanceAdjustmentAction(adjustmentId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Estornado pelo usuário";

  try {
    await reverseBalanceAdjustment(user.id, company.id, adjustmentId, { reason });
  } catch (error) {
    // "erroEstorno" (não "erro") pra não abrir por engano o modal de "Nova
    // conta", que observa "erro=" pra decidir se reabre.
    const message = error instanceof Error ? error.message : "Não foi possível estornar o ajuste.";
    redirect(`/contas?erroEstorno=${encodeURIComponent(message)}`);
  }

  redirect("/contas");
}
