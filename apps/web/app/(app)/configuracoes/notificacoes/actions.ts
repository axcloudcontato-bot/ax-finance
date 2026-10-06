"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateNotificationPreference } from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { actionErrorMessage } from "@/lib/action-errors";

export async function updateNotificationPreferenceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await updateNotificationPreference(user.id, company.id, {
      inAppDue: formData.get("inAppDue") === "on",
      emailDue: formData.get("emailDue") === "on",
      inAppWeekly: formData.get("inAppWeekly") === "on",
      emailWeekly: formData.get("emailWeekly") === "on",
      dueDaysAhead: Number(formData.get("dueDaysAhead")),
      deliveryHour: Number(formData.get("deliveryHour")),
    });
  } catch (error) {
    redirect(`/configuracoes/notificacoes?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar as preferências."))}`);
  }
  revalidatePath("/configuracoes/notificacoes");
  redirect("/configuracoes/notificacoes?salvo=1");
}
