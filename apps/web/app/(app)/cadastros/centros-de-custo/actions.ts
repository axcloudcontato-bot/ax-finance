"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveCostCenter, createCostCenter } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";

export async function createCostCenterAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await createCostCenter(user.id, company.id, {
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? ""),
    });
  } catch (error) {
    redirect(`/cadastros/centros-de-custo?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao criar centro de custo.")}`);
  }
  revalidatePath("/cadastros/centros-de-custo");
  redirect("/cadastros/centros-de-custo?criado=1");
}

export async function archiveCostCenterAction(costCenterId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await archiveCostCenter(user.id, company.id, costCenterId);
  } catch (error) {
    redirect(`/cadastros/centros-de-custo?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao arquivar centro de custo.")}`);
  }
  revalidatePath("/cadastros/centros-de-custo");
  redirect("/cadastros/centros-de-custo?arquivado=1");
}
