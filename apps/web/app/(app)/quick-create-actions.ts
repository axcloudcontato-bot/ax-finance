"use server";

import { redirect } from "next/navigation";
import { PAYMENT_METHOD_LABEL, PossibleDuplicateTitleError, createCategory, createTitle, createTransfer, listActiveCategories, listCostCenters, listFinancialAccounts, listParties } from "@ax-finance/domain";
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
/** `duplicate`: o lançamento é parecido com um existente; a tela pergunta e reenvia confirmando. */
export type QuickCreateResult = { ok: true; message: string } | { ok: false; error: string; duplicate?: boolean };

export interface QuickCreateOptions {
  categories: { id: string; name: string; parentId: string | null }[];
  parties: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  paymentMethods: { key: string; label: string }[];
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
      return { ok: true, options: { categories: [], parties: [], costCenters: [], paymentMethods: [], accounts: accounts.map(({ id, name }) => ({ id, name })) } };
    }
    const [categories, parties, costCenters, accounts] = await Promise.all([
      listActiveCategories(userId, companyId),
      listParties(userId, companyId, { role: kind === "RECEIVABLE" ? "CLIENT" : "SUPPLIER", status: "ACTIVE" }),
      listCostCenters(userId, companyId),
      listFinancialAccounts(userId, companyId),
    ]);
    return {
      ok: true,
      options: {
        paymentMethods: Object.entries(PAYMENT_METHOD_LABEL).map(([key, label]) => ({ key, label })),
        categories: sortCategoriesTree(filterCategoriesByTitleType(categories, kind)).map(({ id, name, parentId }) => ({ id, name, parentId })),
        parties: parties.map(({ id, name }) => ({ id, name })),
        costCenters: costCenters.map(({ id, name }) => ({ id, name })),
        accounts: accounts.filter((account) => account.status === "ACTIVE").map(({ id, name }) => ({ id, name })),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Não foi possível carregar o formulário.") };
  }
}

/** Naturezas que uma saída aceita ao criar a categoria pela janela de lançamento. */
const PAYABLE_NATURES = ["EXPENSE", "COST", "INVESTMENT", "FINANCING"] as const;

export type QuickCategoryResult = { ok: true; category: { id: string; name: string; parentId: string | null } } | { ok: false; error: string };

/**
 * Cria a categoria sem sair do lançamento: entrada vira receita operacional; saída usa a natureza
 * escolhida (despesa por padrão). Devolve a categoria para a janela já selecioná-la.
 */
export async function quickCreateCategoryAction(kind: "RECEIVABLE" | "PAYABLE", input: { name: string; parentId?: string; nature?: string }): Promise<QuickCategoryResult> {
  const { userId, companyId } = await requireContext();
  const nature = kind === "RECEIVABLE" ? "OPERATING_REVENUE" : (PAYABLE_NATURES as readonly string[]).includes(input.nature ?? "") ? input.nature! : "EXPENSE";
  try {
    const category = await createCategory(userId, companyId, { name: input.name, nature, parentId: input.parentId || undefined });
    return { ok: true, category: { id: category.id, name: category.name, parentId: category.parentId } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Não foi possível criar a categoria.") };
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
      expectedAccountId: String(formData.get("expectedAccountId") ?? "") || undefined,
      expectedPaymentMethod: String(formData.get("expectedPaymentMethod") ?? "") || undefined,
      documentNumber: String(formData.get("documentNumber") ?? "") || undefined,
      paymentCode: String(formData.get("paymentCode") ?? "") || undefined,
      // Avisa de lançamento parecido, a não ser que a pessoa já tenha confirmado que é outro.
      checkDuplicates: formData.get("confirmDuplicate") !== "1",
      idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
    });
    return { ok: true, message: kind === "RECEIVABLE" ? "Entrada criada." : "Saída criada." };
  } catch (error) {
    if (error instanceof PossibleDuplicateTitleError) return { ok: false, error: error.message, duplicate: true };
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
