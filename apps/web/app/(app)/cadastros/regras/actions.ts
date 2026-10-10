"use server";

import { redirect } from "next/navigation";
import { createCategoryRule, deleteCategoryRule, updateCategoryRule } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { actionErrorMessage } from "@/lib/action-errors";

// Só a chamada ao domínio fica no try/catch: `redirect()` lança um erro especial que o catch engoliria.

async function context() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function ruleFields(formData: FormData) {
  return {
    pattern: text(formData, "pattern"),
    matchType: text(formData, "matchType") || "CONTAINS",
    appliesTo: text(formData, "appliesTo") || "BOTH",
    categoryId: text(formData, "categoryId"),
    costCenterId: text(formData, "costCenterId") || null,
    partyId: text(formData, "partyId") || null,
  };
}

/** `voltar` deixa a regra criada a partir da conciliação voltar para a mesma linha do extrato. */
function safeBack(formData: FormData): string | null {
  const back = text(formData, "voltar");
  return back.startsWith("/conciliacao") ? back : null;
}

export async function createCategoryRuleAction(formData: FormData) {
  const { user, company } = await context();
  const back = safeBack(formData);
  try {
    await createCategoryRule(user.id, company.id, ruleFields(formData));
  } catch (error) {
    const message = encodeURIComponent(actionErrorMessage(error, "Não foi possível criar a regra."));
    redirect(back ? `${back}&erro=${message}` : `/cadastros/regras?erro=${message}&acao=nova`);
  }
  redirect(back ? `${back}&regraCriada=1` : "/cadastros/regras?criada=1");
}

export async function updateCategoryRuleAction(ruleId: string, formData: FormData) {
  const { user, company } = await context();
  try {
    await updateCategoryRule(user.id, company.id, ruleId, ruleFields(formData));
  } catch (error) {
    redirect(`/cadastros/regras?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar a regra."))}&regra=${ruleId}`);
  }
  redirect("/cadastros/regras?salva=1");
}

export async function deleteCategoryRuleAction(ruleId: string) {
  const { user, company } = await context();
  try {
    await deleteCategoryRule(user.id, company.id, ruleId);
  } catch (error) {
    redirect(`/cadastros/regras?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível excluir a regra."))}`);
  }
  redirect("/cadastros/regras?excluida=1");
}
