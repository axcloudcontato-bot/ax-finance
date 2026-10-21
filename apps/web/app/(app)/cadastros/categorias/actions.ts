"use server";

import { redirect } from "next/navigation";
import { archiveCategory, createCategory, reactivateCategory, updateCategory } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { actionErrorMessage } from "@/lib/action-errors";

/** Volta para a aba da categoria (receitas, despesas ou outras) depois de criar, editar ou arquivar. */
function tabOf(nature: string): string {
  return nature === "OPERATING_REVENUE" ? "receitas" : nature === "TECHNICAL_TRANSFER" ? "outras" : "despesas";
}

function pageUrl(tab: string, extra = ""): string {
  const safeTab = ["receitas", "despesas", "outras"].includes(tab) ? tab : "receitas";
  return `/cadastros/categorias?aba=${safeTab}${extra}`;
}

export async function createCategoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const name = String(formData.get("name") ?? "");
  const nature = String(formData.get("nature") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || undefined;
  const managerialGroup = String(formData.get("managerialGroup") ?? "") || undefined;

  let category: Awaited<ReturnType<typeof createCategory>>;
  try {
    category = await createCategory(user.id, company.id, { name, nature, parentId, managerialGroup, costBehavior: String(formData.get("costBehavior") ?? "UNCLASSIFIED") });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível criar a categoria.");
    redirect(pageUrl(tabOf(nature), `&erro=${encodeURIComponent(message)}`));
  }

  redirect(pageUrl(tabOf(nature), `&criado=${category.id}`));
}

export async function archiveCategoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const categoryId = String(formData.get("categoryId") ?? "");

  await archiveCategory(user.id, company.id, categoryId);

  redirect(pageUrl(String(formData.get("aba") ?? "")));
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await updateCategory(user.id, company.id, categoryId, {
      name: String(formData.get("name") ?? ""), nature: String(formData.get("nature") ?? ""),
      parentId: String(formData.get("parentId") ?? "") || undefined,
      managerialGroup: String(formData.get("managerialGroup") ?? "") || undefined,
      costBehavior: String(formData.get("costBehavior") ?? "UNCLASSIFIED"),
    });
  } catch (error) {
    redirect(pageUrl(String(formData.get("aba") ?? ""), `&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível editar a categoria."))}`));
  }
  redirect(pageUrl(tabOf(String(formData.get("nature") ?? "")), "&atualizado=1"));
}

export async function reactivateCategoryAction(categoryId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  await reactivateCategory(user.id, company.id, categoryId);
  redirect(pageUrl(String(formData.get("aba") ?? "")));
}
