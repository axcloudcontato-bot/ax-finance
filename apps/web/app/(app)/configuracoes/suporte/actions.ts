"use server";

import { redirect } from "next/navigation";
import { createCompanySupportCase } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { actionErrorMessage } from "@/lib/action-errors";

export async function createSupportCaseAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?retorno=%2Fconfiguracoes%2Fsuporte");
  const company = await requirePrimaryCompany(user.id);
  try {
    await createCompanySupportCase(user.id, company.id, {
      subject: String(formData.get("subject") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      contactEmail: user.email,
      priority: String(formData.get("priority") ?? "NORMAL"),
    });
  } catch (error) {
    redirect(`/configuracoes/suporte?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível abrir o chamado."))}`);
  }
  redirect("/configuracoes/suporte?criado=1");
}
