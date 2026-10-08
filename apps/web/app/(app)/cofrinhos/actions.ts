"use server";

import { redirect } from "next/navigation";
import {
  archiveSavingsGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  depositToSavingsGoal,
  reactivateSavingsGoal,
  reverseTransfer,
  updateSavingsGoal,
  withdrawFromSavingsGoal,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

// Só a chamada ao domínio fica no try/catch: `redirect()` lança um erro especial que o catch engoliria.

/** De onde a ação veio, para voltar para a mesma tela. */
type Origin = "lista" | "detalhe";

async function currentContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (formData: FormData, key: string) => text(formData, key) || undefined;

function back(origin: Origin, goalId: string | null, params: Record<string, string>): never {
  const path = origin === "detalhe" && goalId ? `/cofrinhos/${goalId}` : "/cofrinhos";
  const query = new URLSearchParams(params).toString();
  redirect(query ? `${path}?${query}` : path);
}

function goalFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    targetAmountCents: parseAmountToCents(text(formData, "targetAmount")),
    targetDate: optional(formData, "targetDate") ?? null,
    color: text(formData, "color") || "blue",
    icon: text(formData, "icon") || "piggy",
    defaultSourceAccountId: optional(formData, "defaultSourceAccountId") ?? null,
  };
}

export async function createSavingsGoalAction(formData: FormData) {
  const { user, company } = await currentContext();
  const initial = text(formData, "initialAmount");
  if (initial && parseAmountToCents(initial) > 0 && !optional(formData, "defaultSourceAccountId")) {
    back("lista", null, { erro: "Para guardar um valor já na criação, escolha a conta de onde ele sai.", acao: "novo" });
  }
  let goalId: string;
  try {
    const fields = goalFields(formData);
    const goal = await createSavingsGoal(user.id, company.id, {
      ...fields,
      initialAmountCents: initial ? parseAmountToCents(initial) : 0,
      initialSourceAccountId: fields.defaultSourceAccountId,
      idempotencyKey: optional(formData, "idempotencyKey"),
    });
    goalId = goal.id;
  } catch (error) {
    back("lista", null, { erro: actionErrorMessage(error, "Não foi possível criar o cofrinho."), acao: "novo" });
  }
  redirect(`/cofrinhos/${goalId}?criado=1`);
}

export async function updateSavingsGoalAction(goalId: string, origin: Origin, formData: FormData) {
  const { user, company } = await currentContext();
  try {
    await updateSavingsGoal(user.id, company.id, goalId, goalFields(formData));
  } catch (error) {
    back(origin, goalId, { erro: actionErrorMessage(error, "Não foi possível salvar o cofrinho."), cofrinho: goalId, acao: "editar" });
  }
  back(origin, goalId, { salvo: "1" });
}

async function moveAction(direction: "DEPOSIT" | "WITHDRAW", goalId: string, origin: Origin, formData: FormData) {
  const { user, company } = await currentContext();
  const input = {
    accountId: text(formData, "accountId"),
    amountCents: parseAmountToCents(text(formData, "amount")),
    date: text(formData, "date"),
    note: optional(formData, "note"),
    idempotencyKey: optional(formData, "idempotencyKey"),
  };
  try {
    if (direction === "DEPOSIT") await depositToSavingsGoal(user.id, company.id, goalId, input);
    else await withdrawFromSavingsGoal(user.id, company.id, goalId, input);
  } catch (error) {
    back(origin, goalId, {
      erro: actionErrorMessage(error, direction === "DEPOSIT" ? "Não foi possível guardar." : "Não foi possível resgatar."),
      cofrinho: goalId,
      acao: direction === "DEPOSIT" ? "guardar" : "resgatar",
    });
  }
  back(origin, goalId, { [direction === "DEPOSIT" ? "guardado" : "resgatado"]: goalId });
}

export async function depositToSavingsGoalAction(goalId: string, origin: Origin, formData: FormData) {
  return moveAction("DEPOSIT", goalId, origin, formData);
}

export async function withdrawFromSavingsGoalAction(goalId: string, origin: Origin, formData: FormData) {
  return moveAction("WITHDRAW", goalId, origin, formData);
}

export async function archiveSavingsGoalAction(goalId: string, formData: FormData) {
  const { user, company } = await currentContext();
  try {
    await archiveSavingsGoal(user.id, company.id, goalId, { withdrawToAccountId: optional(formData, "withdrawToAccountId") });
  } catch (error) {
    back("detalhe", goalId, { erro: actionErrorMessage(error, "Não foi possível arquivar o cofrinho.") });
  }
  back("lista", null, { arquivado: "1" });
}

export async function reactivateSavingsGoalAction(goalId: string) {
  const { user, company } = await currentContext();
  try {
    await reactivateSavingsGoal(user.id, company.id, goalId);
  } catch (error) {
    back("detalhe", goalId, { erro: actionErrorMessage(error, "Não foi possível reativar o cofrinho.") });
  }
  back("detalhe", goalId, { reativado: "1" });
}

export async function deleteSavingsGoalAction(goalId: string) {
  const { user, company } = await currentContext();
  try {
    await deleteSavingsGoal(user.id, company.id, goalId);
  } catch (error) {
    back("detalhe", goalId, { erro: actionErrorMessage(error, "Não foi possível excluir o cofrinho.") });
  }
  back("lista", null, { excluido: "1" });
}

export async function reverseSavingsGoalMoveAction(goalId: string, transferId: string, formData: FormData) {
  const { user, company } = await currentContext();
  try {
    await reverseTransfer(user.id, company.id, transferId, { reason: text(formData, "reason") || "Estornado pelo usuário" });
  } catch (error) {
    back("detalhe", goalId, { erro: actionErrorMessage(error, "Não foi possível estornar o movimento.") });
  }
  back("detalhe", goalId, { estornado: "1" });
}
