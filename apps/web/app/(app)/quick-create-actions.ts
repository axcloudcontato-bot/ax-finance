"use server";

import { redirect } from "next/navigation";
import { createTitle, createTransfer, listActiveCategories, listCostCenters, listFinancialAccounts, listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";
import { filterCategoriesByTitleType, sortCategoriesTree } from "@/lib/categories";

/**
 * Criação rápida (botão "+" do menu superior e atalhos do dashboard): abre num modal sobre a
 * tela atual e NÃO redireciona. As ações devolvem o resultado e quem chamou decide fechar o modal
 * e atualizar a tela em que a pessoa está.
 */

export type QuickCreateKind = "RECEIVABLE" | "PAYABLE" | "TRANSFER";
export type QuickCreateResult = { ok: true; message: string } | { ok: false; error: string };

export interface QuickCreateOptions {
  categories: { id: string; name: string; parentId: string | null }[];
  parties: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}

async function requireContext() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  return { userId: user.id, companyId: company.id };
}

/** Só o que o formulário do tipo pedido precisa, carregado quando o modal abre (não pesa nas outras telas). */
export async function loadQuickCreateOptionsAction(kind: QuickCreateKind): Promise<{ ok: true; options: QuickCreateOptions } | { ok: false; error: string }> {
  const { userId, companyId } = await requireContext();
  try {
    if (kind === "TRANSFER") {
      const accounts = await listFinancialAccounts(userId, companyId);
      return { ok: true, options: { categories: [], parties: [], costCenters: [], accounts: accounts.map(({ id, name }) => ({ id, name })) } };
    }
    const [categories, parties, costCenters] = await Promise.all([
      listActiveCategories(userId, companyId),
      listParties(userId, companyId, { role: kind === "RECEIVABLE" ? "CLIENT" : "SUPPLIER", status: "ACTIVE" }),
      listCostCenters(userId, companyId),
    ]);
    return {
      ok: true,
      options: {
        categories: sortCategoriesTree(filterCategoriesByTitleType(categories, kind)).map(({ id, name, parentId }) => ({ id, name, parentId })),
        parties: parties.map(({ id, name }) => ({ id, name })),
        costCenters: costCenters.map(({ id, name }) => ({ id, name })),
        accounts: [],
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Não foi possível carregar o formulário.") };
  }
}

export async function quickCreateTitleAction(kind: "RECEIVABLE" | "PAYABLE", formData: FormData): Promise<QuickCreateResult> {
  const { userId, companyId } = await requireContext();
  try {
    await createTitle(userId, companyId, {
      type: kind,
      description: String(formData.get("description") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      partyId: String(formData.get("partyId") ?? "") || undefined,
      costCenterId: String(formData.get("costCenterId") ?? "") || undefined,
      originalAmountCents: parseAmountToCents(String(formData.get("amount") ?? "0")),
      competenceDate: String(formData.get("competenceDate") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      notes: String(formData.get("notes") ?? "") || undefined,
      idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
    });
    return { ok: true, message: kind === "RECEIVABLE" ? "Entrada criada." : "Saída criada." };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Não foi possível criar o lançamento.") };
  }
}

export async function quickCreateTransferAction(formData: FormData): Promise<QuickCreateResult> {
  const { userId, companyId } = await requireContext();
  try {
    await createTransfer(userId, companyId, {
      fromAccountId: String(formData.get("fromAccountId") ?? ""),
      toAccountId: String(formData.get("toAccountId") ?? ""),
      amountCents: parseAmountToCents(String(formData.get("amount") ?? "0")),
      feeCents: parseAmountToCents(String(formData.get("fee") ?? "0")),
      transferDate: String(formData.get("transferDate") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
    });
    return { ok: true, message: "Transferência registrada." };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Não foi possível criar a transferência.") };
  }
}
