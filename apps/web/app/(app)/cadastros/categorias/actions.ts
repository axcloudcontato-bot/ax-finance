"use server";

import { redirect } from "next/navigation";
import { archiveCategory, createCategory, reactivateCategory, updateCategory } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

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
    category = await createCategory(user.id, company.id, { name, nature, parentId, managerialGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a categoria.";
    redirect(`/cadastros/categorias?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/cadastros/categorias?criado=${category.id}`);
}

export async function archiveCategoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const categoryId = String(formData.get("categoryId") ?? "");

  await archiveCategory(user.id, company.id, categoryId);

  redirect("/cadastros/categorias");
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
    });
  } catch (error) {
    redirect(`/cadastros/categorias?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível editar a categoria.")}`);
  }
  redirect("/cadastros/categorias?atualizado=1");
}

export async function reactivateCategoryAction(categoryId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  await reactivateCategory(user.id, company.id, categoryId);
  redirect("/cadastros/categorias");
}
