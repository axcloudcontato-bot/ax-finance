"use server";

import { redirect } from "next/navigation";
import { queueMonthlyReportForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { actionErrorMessage } from "@/lib/action-errors";
import { publicBaseUrl } from "@/lib/email";
import { isYearMonth } from "@/lib/month";

/** "Enviar para meu e-mail": põe o relatório do mês na fila de e-mail (o PDF é montado pelo worker no envio). */
export async function sendMonthlyReportNowAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  const month = String(formData.get("month") ?? "");
  if (!isYearMonth(month)) redirect("/relatorios/mensal");
  try {
    await queueMonthlyReportForUser(user.id, company.id, month, publicBaseUrl());
  } catch (error) {
    redirect(`/relatorios/mensal?mes=${month}&erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível enviar o relatório."))}`);
  }
  redirect(`/relatorios/mensal?mes=${month}&enviado=1`);
}
