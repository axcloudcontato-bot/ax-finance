"use server";

import { redirect } from "next/navigation";
import { archiveCategory, createCategory } from "@ax-finance/domain";
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

  let category: Awaited<ReturnType<typeof createCategory>>;
  try {
    category = await createCategory(user.id, company.id, { name, nature, parentId });
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
