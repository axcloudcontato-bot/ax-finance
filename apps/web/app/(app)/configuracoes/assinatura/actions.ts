"use server";

import { redirect } from "next/navigation";
import { getCompanySubscription, scheduleSubscriptionCancellation, undoSubscriptionCancellation } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { setStripeCancelAtPeriodEnd, userFacingBillingError } from "@/lib/stripe";

async function actor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?retorno=%2Fconfiguracoes%2Fassinatura");
  const company = await requirePrimaryCompany(user.id);
  return { user, company };
}

export async function scheduleCancellationAction(formData: FormData) {
  const { user, company } = await actor();
  if (formData.get("confirmation") !== "CANCELAR") redirect("/configuracoes/assinatura?erro=Digite%20CANCELAR%20para%20confirmar.");
  try {
    // A Stripe primeiro: se ela recusar, nada muda localmente e a cobrança segue coerente.
    await setStripeCancelAtPeriodEnd((await getCompanySubscription(user.id, company.id))?.stripeSubscriptionId, true);
    await scheduleSubscriptionCancellation(user.id, company.id);
  }
  catch (error) { redirect(`/configuracoes/assinatura?erro=${encodeURIComponent(userFacingBillingError(error, "Não foi possível agendar o cancelamento. Tente novamente em instantes."))}`); }
  redirect("/configuracoes/assinatura?cancelamento=agendado");
}

export async function undoCancellationAction(_formData: FormData) {
  const { user, company } = await actor();
  try {
    await setStripeCancelAtPeriodEnd((await getCompanySubscription(user.id, company.id))?.stripeSubscriptionId, false);
    await undoSubscriptionCancellation(user.id, company.id);
  }
  catch (error) { redirect(`/configuracoes/assinatura?erro=${encodeURIComponent(userFacingBillingError(error, "Não foi possível desfazer o cancelamento. Tente novamente em instantes."))}`); }
  redirect("/configuracoes/assinatura?cancelamento=desfeito");
}
