"use server";

import { redirect } from "next/navigation";
import { createAsset, createDebt, deleteAsset, deleteDebt, setDebtArchived, updateAsset } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

// Só a chamada ao domínio fica no try/catch: `redirect()` lança um erro especial que o catch engoliria.

async function context() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const integer = (formData: FormData, key: string, fallback = 0) => {
  const value = text(formData, key);
  return value ? Number.parseInt(value, 10) : fallback;
};

/** "1,89" (% ao mês) → 189 pontos-base. */
function rateBps(formData: FormData): number {
  const value = Number(text(formData, "monthlyRate").replace("%", "").replace(",", ".") || "0");
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

export async function createDebtAction(formData: FormData) {
  const { user, company } = await context();
  let debtId: string;
  try {
    const debt = await createDebt(user.id, company.id, {
      name: text(formData, "name"),
      kind: text(formData, "kind") || "FINANCING",
      lender: text(formData, "lender") || null,
      principalCents: parseAmountToCents(text(formData, "principal")),
      monthlyRateBps: rateBps(formData),
      installmentCount: integer(formData, "installmentCount"),
      paidBeforeCount: integer(formData, "paidBeforeCount"),
      firstDueDate: text(formData, "firstDueDate"),
      amortization: text(formData, "amortization") || "PRICE",
      categoryId: text(formData, "categoryId"),
      expectedAccountId: text(formData, "expectedAccountId") || null,
    });
    debtId = debt.id;
  } catch (error) {
    redirect(`/dividas?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível cadastrar a dívida."))}&acao=nova`);
  }
  redirect(`/dividas/${debtId}?criada=1`);
}

export async function setDebtArchivedAction(debtId: string, archived: boolean) {
  const { user, company } = await context();
  try {
    await setDebtArchived(user.id, company.id, debtId, archived);
  } catch (error) {
    redirect(`/dividas/${debtId}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível alterar a dívida."))}`);
  }
  redirect(archived ? "/dividas?arquivada=1" : `/dividas/${debtId}?reativada=1`);
}

export async function deleteDebtAction(debtId: string) {
  const { user, company } = await context();
  try {
    await deleteDebt(user.id, company.id, debtId);
  } catch (error) {
    redirect(`/dividas/${debtId}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível excluir a dívida."))}`);
  }
  redirect("/dividas?excluida=1");
}

function assetFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    kind: text(formData, "kind") || "INVESTMENT",
    valueCents: parseAmountToCents(text(formData, "value")),
    valuedAt: text(formData, "valuedAt"),
    notes: text(formData, "notes") || null,
  };
}

export async function createAssetAction(formData: FormData) {
  const { user, company } = await context();
  try {
    await createAsset(user.id, company.id, assetFields(formData));
  } catch (error) {
    redirect(`/patrimonio?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível cadastrar o bem."))}&acao=novo`);
  }
  redirect("/patrimonio?bemSalvo=1");
}

export async function updateAssetAction(assetId: string, formData: FormData) {
  const { user, company } = await context();
  try {
    await updateAsset(user.id, company.id, assetId, assetFields(formData));
  } catch (error) {
    redirect(`/patrimonio?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar o bem."))}&bem=${assetId}`);
  }
  redirect("/patrimonio?bemSalvo=1");
}

export async function deleteAssetAction(assetId: string) {
  const { user, company } = await context();
  try {
    await deleteAsset(user.id, company.id, assetId);
  } catch (error) {
    redirect(`/patrimonio?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível excluir o bem."))}`);
  }
  redirect("/patrimonio?bemExcluido=1");
}
