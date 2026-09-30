"use server";

import { redirect } from "next/navigation";
import { scheduleSubscriptionCancellation, undoSubscriptionCancellation } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";

async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?retorno=%2Fconfiguracoes%2Fassinatura");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

export async function scheduleCancellationAction(formData: FormData) {
  const { user, company } = await actor();
  if (formData.get("confirmation") !== "CANCELAR") redirect("/configuracoes/assinatura?erro=Digite%20CANCELAR%20para%20confirmar.");
  try { await scheduleSubscriptionCancellation(user.id, company.id); }
  catch (error) { redirect(`/configuracoes/assinatura?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível agendar o cancelamento.")}`); }
  redirect("/configuracoes/assinatura?cancelamento=agendado");
}

export async function undoCancellationAction(_formData: FormData) {
  const { user, company } = await actor();
  try { await undoSubscriptionCancellation(user.id, company.id); }
  catch (error) { redirect(`/configuracoes/assinatura?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível desfazer o cancelamento.")}`); }
  redirect("/configuracoes/assinatura?cancelamento=desfeito");
}
