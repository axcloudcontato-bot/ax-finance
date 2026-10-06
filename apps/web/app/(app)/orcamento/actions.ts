"use server";

import { redirect } from "next/navigation";
import { copyBudgets, setBudget } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCentsOrNull } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodOf(formData: FormData): string {
  const value = String(formData.get("period") ?? "");
  return PERIOD.test(value) ? value : "";
}

/**
 * Salva só o que mudou: cada linha manda o valor digitado (`amount_<id>`) e o que estava na tela
 * (`was_<id>`). Campo vazio vale 0 e remove o orçamento da categoria naquele mês.
 */
export async function saveBudgetsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const period = periodOf(formData);
  if (!period) redirect("/orcamento");

  let saved = 0;
  try {
    for (const [key, raw] of formData.entries()) {
      if (!key.startsWith("amount_")) continue;
      const categoryId = key.slice("amount_".length);
      const typed = String(raw).trim();
      if (typed === String(formData.get(`was_${categoryId}`) ?? "").trim()) continue;

      const amountCents = typed === "" ? 0 : parseAmountToCentsOrNull(typed);
      if (amountCents === null || amountCents < 0) {
        redirect(`/orcamento?mes=${period}&erro=${encodeURIComponent(`Valor inválido: “${typed}”. Use números, como 1.200,00.`)}`);
      }
      await setBudget(user.id, company.id, { categoryId, period, amountCents });
      saved += 1;
    }
  } catch (error) {
    redirect(`/orcamento?mes=${period}&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar o orçamento."))}`);
  }
  redirect(`/orcamento?mes=${period}&salvo=${saved}`);
}

/** Traz para este mês os valores do mês anterior, nas categorias que ainda estão em branco. */
export async function copyBudgetsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const period = periodOf(formData);
  const from = String(formData.get("from") ?? "");
  if (!period || !PERIOD.test(from)) redirect("/orcamento");

  let copied: number;
  try {
    copied = (await copyBudgets(user.id, company.id, { fromPeriod: from, toPeriod: period })).copied;
  } catch (error) {
    redirect(`/orcamento?mes=${period}&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível copiar o orçamento."))}`);
  }
  redirect(`/orcamento?mes=${period}&copiado=${copied}`);
}
