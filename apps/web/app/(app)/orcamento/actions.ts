"use server";

import { redirect } from "next/navigation";
import { copyBudgets, fillBudgetYear, saveBudgetCells, setBudget } from "@ax-finance/domain";
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

function yearOf(formData: FormData): number | null {
  const value = String(formData.get("year") ?? "");
  return /^\d{4}$/.test(value) ? Number(value) : null;
}

/**
 * Grade do ano: cada célula manda o valor digitado (`a|categoria|mês`) e o que estava na tela
 * (`w|categoria|mês`). Só vai para o banco o que mudou de valor (a máscara pode reescrever "1.200" como
 * "1.200,00" sem mudar nada). Vazio vale 0 e remove o orçamento daquele mês.
 */
export async function saveBudgetYearAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const year = yearOf(formData);
  if (!year) redirect("/orcamento/ano");

  const cells: { categoryId: string; period: string; amountCents: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("a|")) continue;
    const [, categoryId, period] = key.split("|");
    if (!categoryId || !period || !PERIOD.test(period)) continue;
    const typed = String(raw).trim();
    const amountCents = typed === "" ? 0 : parseAmountToCentsOrNull(typed);
    if (amountCents === null || amountCents < 0) {
      redirect(`/orcamento/ano?ano=${year}&erro=${encodeURIComponent(`Valor inválido: “${typed}”. Use números, como 1.200 ou 1.200,50.`)}`);
    }
    const before = String(formData.get(`w|${categoryId}|${period}`) ?? "").trim();
    const beforeCents = before === "" ? 0 : parseAmountToCentsOrNull(before) ?? -1;
    if (beforeCents !== amountCents) cells.push({ categoryId, period, amountCents });
  }

  let saved = 0;
  try {
    saved = (await saveBudgetCells(user.id, company.id, { cells })).saved;
  } catch (error) {
    redirect(`/orcamento/ano?ano=${year}&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar o orçamento."))}`);
  }
  redirect(`/orcamento/ano?ano=${year}&salvo=${saved}`);
}

/** "Planejar o ano": copia um mês, repete o ano anterior ou parte do gasto real, com reajuste em %. */
export async function fillBudgetYearAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const year = yearOf(formData);
  if (!year) redirect("/orcamento/ano");
  const adjustmentText = String(formData.get("adjustment") ?? "").trim().replace("−", "-").replace(",", ".").replace("%", "");
  const adjustment = adjustmentText ? Number(adjustmentText) : 0;
  if (!Number.isFinite(adjustment)) redirect(`/orcamento/ano?ano=${year}&erro=${encodeURIComponent("Reajuste inválido. Use um número, como 5 ou -10.")}`);

  let written = 0;
  try {
    written = (await fillBudgetYear(user.id, company.id, {
      year,
      mode: String(formData.get("mode") ?? "COPY_MONTH"),
      sourcePeriod: String(formData.get("sourcePeriod") ?? "") || undefined,
      adjustmentBps: Math.round(adjustment * 100),
      overwrite: formData.get("overwrite") === "true",
    })).written;
  } catch (error) {
    redirect(`/orcamento/ano?ano=${year}&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível planejar o ano."))}`);
  }
  redirect(`/orcamento/ano?ano=${year}&planejado=${written}`);
}
